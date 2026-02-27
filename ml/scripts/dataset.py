"""
dataset.py — PyTorch Dataset for roof edge segmentation training.

Loads image+mask pairs from the annotated directory.
Applies augmentations via albumentations (spatial transforms applied
identically to both image and mask).

Image format: 640x640 RGB PNG
Mask format: 640x640 single-channel PNG, pixel values 0-6
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
            image2.png
            image2_mask.png
            ...
    """

    def __init__(
        self,
        data_dir: str,
        transform: Optional[A.Compose] = None,
        image_size: int = 640,
        normalize_mean: tuple = (0.485, 0.456, 0.406),
        normalize_std: tuple = (0.229, 0.224, 0.225),
    ):
        self.data_dir = Path(data_dir)
        self.image_size = image_size
        self.normalize_mean = normalize_mean
        self.normalize_std = normalize_std
        self.transform = transform

        # Find all image+mask pairs
        self.pairs = []
        for img_file in sorted(self.data_dir.glob("*.png")):
            if "_mask" in img_file.name:
                continue
            mask_file = self.data_dir / img_file.name.replace(".png", "_mask.png")
            if mask_file.exists():
                self.pairs.append((img_file, mask_file))

        if len(self.pairs) == 0:
            raise ValueError(f"No image+mask pairs found in {data_dir}")

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> dict:
        img_path, mask_path = self.pairs[idx]

        # Load image as RGB
        image = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Load mask as grayscale
        mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)

        # Resize if needed
        if image.shape[:2] != (self.image_size, self.image_size):
            image = cv2.resize(image, (self.image_size, self.image_size), interpolation=cv2.INTER_LINEAR)
        if mask.shape[:2] != (self.image_size, self.image_size):
            mask = cv2.resize(mask, (self.image_size, self.image_size), interpolation=cv2.INTER_NEAREST)

        # Clamp mask values to valid range
        mask = np.clip(mask, 0, 6)

        # Apply augmentations
        if self.transform:
            transformed = self.transform(image=image, mask=mask)
            image = transformed["image"]
            mask = transformed["mask"]

        # Normalize image: float32 [0,1] then ImageNet stats
        image = image.astype(np.float32) / 255.0
        for c in range(3):
            image[:, :, c] = (image[:, :, c] - self.normalize_mean[c]) / self.normalize_std[c]

        # Convert to tensors: image [C, H, W], mask [H, W]
        image_tensor = torch.from_numpy(image.transpose(2, 0, 1))  # HWC -> CHW
        mask_tensor = torch.from_numpy(mask.astype(np.int64))

        return {
            "image": image_tensor,
            "mask": mask_tensor,
            "filename": img_path.name,
        }


def get_train_augmentations(config: dict) -> A.Compose:
    """Build training augmentation pipeline from config."""
    aug_cfg = config.get("training", {}).get("augmentation", {})
    transforms = []

    if aug_cfg.get("horizontal_flip", True):
        transforms.append(A.HorizontalFlip(p=0.5))

    if aug_cfg.get("vertical_flip", True):
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

    crop_scale = aug_cfg.get("random_crop_scale")
    if crop_scale:
        image_size = config.get("training", {}).get("image_size", 640)
        transforms.append(A.RandomResizedCrop(
            size=(image_size, image_size),
            scale=tuple(crop_scale),
            ratio=(0.9, 1.1),
            p=0.3,
        ))

    return A.Compose(transforms)


def get_val_augmentations() -> A.Compose:
    """Validation augmentations: none (just load as-is)."""
    return A.Compose([])


def split_dataset(data_dir: str, train_dir: str, val_dir: str, test_dir: str,
                  train_ratio: float = 0.70, val_ratio: float = 0.15, seed: int = 42):
    """Split annotated data into train/val/test directories using symlinks."""
    import shutil

    data_path = Path(data_dir)
    pairs = []
    for img_file in sorted(data_path.glob("*.png")):
        if "_mask" in img_file.name:
            continue
        mask_file = data_path / img_file.name.replace(".png", "_mask.png")
        if mask_file.exists():
            pairs.append((img_file, mask_file))

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
        for img_file, mask_file in split_pairs:
            shutil.copy2(img_file, split_path / img_file.name)
            shutil.copy2(mask_file, split_path / mask_file.name)
        print(f"  {split_path.name}: {len(split_pairs)} pairs")


if __name__ == "__main__":
    # Quick test
    import yaml
    config_path = Path(__file__).resolve().parent.parent / "configs" / "model_config.yaml"
    with open(config_path) as f:
        config = yaml.safe_load(f)

    data_dir = Path(__file__).resolve().parent.parent / "data" / "annotated"
    if data_dir.exists() and any(data_dir.glob("*.png")):
        aug = get_train_augmentations(config)
        ds = RoofEdgeDataset(str(data_dir), transform=aug)
        print(f"Dataset: {len(ds)} pairs")
        sample = ds[0]
        print(f"Image shape: {sample['image'].shape}")
        print(f"Mask shape: {sample['mask'].shape}")
        print(f"Mask unique values: {torch.unique(sample['mask']).tolist()}")
    else:
        print(f"No data found in {data_dir}. Annotate images first.")
