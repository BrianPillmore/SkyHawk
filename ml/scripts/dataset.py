"""
dataset.py — PyTorch Dataset for roof edge segmentation training.

Loads image+mask pairs from the annotated directory.
Applies augmentations via albumentations (spatial transforms applied
identically to both image and mask).

Supports two input modes:
  - RGB only: [3, 640, 640] — standard satellite imagery
  - RGB + DSM: [4, 640, 640] — satellite + height channel from Google Solar API
    (research: DLR ROOF3D showed height improves roof plane boundary detection)

Key augmentation: D4 SquareSymmetry — applies all 8 symmetries of a square
(4 rotations x 2 flips) giving 8x effective training data. Satellite imagery
is orientation-agnostic so this is free data augmentation.

Image format: 640x640 RGB PNG
Mask format: 640x640 single-channel PNG, pixel values 0-6
DSM format (optional): 640x640 single-channel float32 NPY
"""

import os
import random
from pathlib import Path
from typing import Optional

import albumentations as A
import cv2
import numpy as np
import torch
from torch.utils.data import Dataset


class RoofEdgeDataset(Dataset):
    """Dataset for roof edge segmentation.

    Expects directory structure:
        dir/
            image1.png        # 640x640 RGB satellite image
            image1_mask.png   # 640x640 single-channel mask (values 0-6)
            image1_dsm.npy    # (optional) 640x640 float32 height values
            ...

    Edge maps for HED-UNet training are auto-generated from masks:
    any pixel adjacent to a different class is an edge pixel.
    """

    def __init__(
        self,
        data_dir: str,
        transform: Optional[A.Compose] = None,
        image_size: int = 640,
        normalize_mean: tuple = (0.485, 0.456, 0.406),
        normalize_std: tuple = (0.229, 0.224, 0.225),
        use_dsm: bool = False,
        generate_edge_maps: bool = False,
        correction_weight: float = 1.0,
    ):
        self.data_dir = Path(data_dir)
        self.image_size = image_size
        self.normalize_mean = normalize_mean
        self.normalize_std = normalize_std
        self.transform = transform
        self.use_dsm = use_dsm
        self.generate_edge_maps = generate_edge_maps
        self.correction_weight = correction_weight

        # Find all image+mask pairs
        self.pairs = []
        for img_file in sorted(self.data_dir.glob("*.png")):
            if "_mask" in img_file.name:
                continue
            mask_file = self.data_dir / img_file.name.replace(".png", "_mask.png")
            if mask_file.exists():
                # Check if this is a user correction (higher weight in training)
                meta_file = self.data_dir / img_file.name.replace(".png", "_meta.json")
                is_correction = False
                if meta_file.exists():
                    import json
                    with open(meta_file) as f:
                        meta = json.load(f)
                    is_correction = meta.get("source") == "user-correction"

                dsm_file = self.data_dir / img_file.name.replace(".png", "_dsm.npy")
                self.pairs.append({
                    "image": img_file,
                    "mask": mask_file,
                    "dsm": dsm_file if dsm_file.exists() else None,
                    "is_correction": is_correction,
                })

        if len(self.pairs) == 0:
            raise ValueError(f"No image+mask pairs found in {data_dir}")

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> dict:
        pair = self.pairs[idx]

        # Load image as RGB
        image = cv2.imread(str(pair["image"]), cv2.IMREAD_COLOR)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Load mask as grayscale
        mask = cv2.imread(str(pair["mask"]), cv2.IMREAD_GRAYSCALE)

        # Load DSM if available and enabled
        dsm = None
        if self.use_dsm and pair["dsm"] is not None:
            dsm = np.load(str(pair["dsm"]))

        # Resize if needed
        if image.shape[:2] != (self.image_size, self.image_size):
            image = cv2.resize(image, (self.image_size, self.image_size), interpolation=cv2.INTER_LINEAR)
        if mask.shape[:2] != (self.image_size, self.image_size):
            mask = cv2.resize(mask, (self.image_size, self.image_size), interpolation=cv2.INTER_NEAREST)
        if dsm is not None and dsm.shape[:2] != (self.image_size, self.image_size):
            dsm = cv2.resize(dsm, (self.image_size, self.image_size), interpolation=cv2.INTER_LINEAR)

        # Clamp mask values to valid range
        mask = np.clip(mask, 0, 6)

        # Apply augmentations
        if self.transform:
            if dsm is not None:
                # Stack DSM as 4th channel for joint augmentation
                image_4ch = np.dstack([image, dsm[..., np.newaxis] if dsm.ndim == 2 else dsm])
                transformed = self.transform(image=image_4ch, mask=mask)
                image_4ch = transformed["image"]
                mask = transformed["mask"]
                image = image_4ch[:, :, :3]
                dsm = image_4ch[:, :, 3]
            else:
                transformed = self.transform(image=image, mask=mask)
                image = transformed["image"]
                mask = transformed["mask"]

        # Normalize image: float32 [0,1] then ImageNet stats
        image = image.astype(np.float32) / 255.0
        for c in range(3):
            image[:, :, c] = (image[:, :, c] - self.normalize_mean[c]) / self.normalize_std[c]

        # Convert to tensor: image [C, H, W], mask [H, W]
        image_tensor = torch.from_numpy(image.transpose(2, 0, 1))  # HWC -> CHW

        # Append DSM as 4th channel if enabled
        if self.use_dsm and dsm is not None:
            # Normalize DSM: min-max per image to [0, 1]
            dsm = dsm.astype(np.float32)
            dsm_min, dsm_max = dsm.min(), dsm.max()
            if dsm_max > dsm_min:
                dsm = (dsm - dsm_min) / (dsm_max - dsm_min)
            else:
                dsm = np.zeros_like(dsm)
            dsm_tensor = torch.from_numpy(dsm).unsqueeze(0)  # [1, H, W]
            image_tensor = torch.cat([image_tensor, dsm_tensor], dim=0)  # [4, H, W]

        mask_tensor = torch.from_numpy(mask.astype(np.int64))

        result = {
            "image": image_tensor,
            "mask": mask_tensor,
            "filename": pair["image"].name,
        }

        # Generate edge map for HED-UNet training
        if self.generate_edge_maps:
            edge_map = self._generate_edge_map(mask)
            result["edge_map"] = torch.from_numpy(edge_map).unsqueeze(0).float()

        # Sample weight (corrections weighted higher for active learning)
        if pair["is_correction"]:
            result["weight"] = self.correction_weight
        else:
            result["weight"] = 1.0

        return result

    def _generate_edge_map(self, mask: np.ndarray) -> np.ndarray:
        """Generate binary edge map from segmentation mask.

        Any pixel adjacent to a different class is marked as an edge.
        Used as ground truth for the HED-UNet edge detection head.
        """
        edge = np.zeros_like(mask, dtype=np.float32)
        # Check 4-connectivity: if any neighbor has a different class, it's an edge
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            shifted = np.roll(np.roll(mask, dy, axis=0), dx, axis=1)
            edge = np.maximum(edge, (mask != shifted).astype(np.float32))
        return edge


def get_train_augmentations(config: dict) -> A.Compose:
    """Build training augmentation pipeline from config.

    Research-backed augmentations:
    - D4 SquareSymmetry: all 8 symmetries → 8x data (satellite has no 'up')
    - Color: brightness/contrast/hue (satellite varies by season/time)
    - Cutout/CoarseDropout: masks regions (Omdena study, p=0.3)
    - Random crop: scale invariance
    - Elastic/grid distortion: slight deformation for robustness
    """
    aug_cfg = config.get("training", {}).get("augmentation", {})
    transforms = []

    # D4 SquareSymmetry: all 8 symmetries of a square (4 rotations x 2 flips)
    # This is the single most effective augmentation for top-down imagery
    # Replaces separate horizontal_flip + vertical_flip + random_rotate_90
    if aug_cfg.get("horizontal_flip", True) or aug_cfg.get("vertical_flip", True):
        transforms.append(A.HorizontalFlip(p=0.5))
        transforms.append(A.VerticalFlip(p=0.5))

    if aug_cfg.get("random_rotate_90", True):
        transforms.append(A.RandomRotate90(p=0.5))

    bc = aug_cfg.get("brightness_contrast", {})
    if bc:
        transforms.append(A.RandomBrightnessContrast(
            brightness_limit=bc.get("brightness_limit", 0.2),
            contrast_limit=bc.get("contrast_limit", 0.2),
            p=0.5,
        ))

    cj = aug_cfg.get("color_jitter", {})
    if cj:
        transforms.append(A.HueSaturationValue(
            hue_shift_limit=int(cj.get("hue", 0.05) * 180),
            sat_shift_limit=int(cj.get("saturation", 0.2) * 255),
            val_shift_limit=20,
            p=0.3,
        ))

    # CLAHE: adaptive histogram equalization (improves contrast on shadows)
    transforms.append(A.CLAHE(p=0.2))

    # Gaussian noise (sensor noise simulation)
    transforms.append(A.GaussNoise(p=0.15))

    crop_scale = aug_cfg.get("random_crop_scale")
    if crop_scale:
        image_size = config.get("training", {}).get("image_size", 640)
        transforms.append(A.RandomResizedCrop(
            size=(image_size, image_size),
            scale=tuple(crop_scale),
            ratio=(0.9, 1.1),
            p=0.3,
        ))

    # Cutout / CoarseDropout (research: Omdena rooftop project)
    cutout_cfg = aug_cfg.get("cutout", {})
    if cutout_cfg.get("enabled", False):
        transforms.append(A.CoarseDropout(
            max_holes=cutout_cfg.get("num_holes", 4),
            max_height=cutout_cfg.get("max_h_size", 64),
            max_width=cutout_cfg.get("max_w_size", 64),
            min_holes=1,
            min_height=16,
            min_width=16,
            fill_value=0,
            mask_fill_value=0,
            p=cutout_cfg.get("p", 0.3),
        ))

    return A.Compose(transforms)


def get_val_augmentations() -> A.Compose:
    """Validation augmentations: none (just load as-is)."""
    return A.Compose([])


def get_tta_augmentations(image_size: int = 640) -> list:
    """Test-Time Augmentation: all 8 D4 symmetries.

    At inference, run the model on all 8 orientations and average predictions.
    Zero additional training data cost, reduces prediction variance.

    Returns list of (transform, inverse_transform) pairs.
    """
    transforms = []
    for k in range(4):  # 0, 90, 180, 270 degree rotations
        for flip in [False, True]:  # with and without horizontal flip
            fwd = A.Compose([
                A.HorizontalFlip(p=1.0 if flip else 0.0),
                A.Rotate(limit=(k * 90, k * 90), p=1.0 if k > 0 else 0.0,
                         border_mode=cv2.BORDER_CONSTANT),
            ])
            inv = A.Compose([
                A.Rotate(limit=(-k * 90, -k * 90), p=1.0 if k > 0 else 0.0,
                         border_mode=cv2.BORDER_CONSTANT),
                A.HorizontalFlip(p=1.0 if flip else 0.0),
            ])
            transforms.append((fwd, inv))
    return transforms


def split_dataset(data_dir: str, train_dir: str, val_dir: str, test_dir: str,
                  train_ratio: float = 0.70, val_ratio: float = 0.15, seed: int = 42):
    """Split annotated data into train/val/test directories."""
    import shutil

    data_path = Path(data_dir)
    pairs = []
    for img_file in sorted(data_path.glob("*.png")):
        if "_mask" in img_file.name:
            continue
        mask_file = data_path / img_file.name.replace(".png", "_mask.png")
        if mask_file.exists():
            related_files = [img_file, mask_file]
            # Also include DSM and metadata if they exist
            dsm_file = data_path / img_file.name.replace(".png", "_dsm.npy")
            meta_file = data_path / img_file.name.replace(".png", "_meta.json")
            if dsm_file.exists():
                related_files.append(dsm_file)
            if meta_file.exists():
                related_files.append(meta_file)
            pairs.append(related_files)

    random.seed(seed)
    random.shuffle(pairs)

    n = len(pairs)
    n_train = int(n * train_ratio)
    n_val = int(n * val_ratio)

    splits = {
        train_dir: pairs[:n_train],
        val_dir: pairs[n_train:n_train + n_val],
        test_dir: pairs[n_train + n_val:],
    }

    for split_dir, split_pairs in splits.items():
        split_path = Path(split_dir)
        split_path.mkdir(parents=True, exist_ok=True)
        for files in split_pairs:
            for f in files:
                shutil.copy2(f, split_path / f.name)
        print(f"  {split_path.name}: {len(split_pairs)} pairs")


if __name__ == "__main__":
    import yaml
    config_path = Path(__file__).resolve().parent.parent / "configs" / "model_config.yaml"
    with open(config_path) as f:
        config = yaml.safe_load(f)

    data_dir = Path(__file__).resolve().parent.parent / "data" / "annotated"
    if data_dir.exists() and any(data_dir.glob("*.png")):
        aug = get_train_augmentations(config)
        ds = RoofEdgeDataset(str(data_dir), transform=aug, generate_edge_maps=True)
        print(f"Dataset: {len(ds)} pairs")
        sample = ds[0]
        print(f"Image shape: {sample['image'].shape}")
        print(f"Mask shape: {sample['mask'].shape}")
        print(f"Mask unique values: {torch.unique(sample['mask']).tolist()}")
        if "edge_map" in sample:
            print(f"Edge map shape: {sample['edge_map'].shape}")
            print(f"Edge pixels: {sample['edge_map'].sum().item():.0f}")
    else:
        print(f"No data found in {data_dir}. Annotate images first.")
