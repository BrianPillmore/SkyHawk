"""
evaluate.py — Evaluate trained roof edge segmentation model.

Generates:
1. Per-class IoU report
2. Confusion matrix
3. Side-by-side overlays: original | ground truth | predicted
4. Edge precision/recall (within 3px tolerance)

Usage:
    python evaluate.py --checkpoint ../models/best.pth [--data-dir ../data/test]
                       [--output-dir ../models/evaluation]
"""

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import torch
from torch.utils.data import DataLoader
from tqdm import tqdm

from model import create_model, load_config
from dataset import RoofEdgeDataset, get_val_augmentations


CLASS_NAMES = ["background", "roof_surface", "ridge", "hip", "valley", "eave_rake", "flashing"]
CLASS_COLORS = [
    (0, 0, 0),        # background: black
    (128, 128, 128),   # roof_surface: gray
    (255, 0, 0),       # ridge: red
    (255, 165, 0),     # hip: orange
    (0, 0, 255),       # valley: blue
    (0, 255, 0),       # eave_rake: green
    (192, 192, 192),   # flashing: light gray
]

EDGE_CLASSES = [2, 3, 4, 5, 6]
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406])
IMAGENET_STD = np.array([0.229, 0.224, 0.225])


def mask_to_color(mask: np.ndarray) -> np.ndarray:
    """Convert class mask to RGB color image."""
    h, w = mask.shape
    color = np.zeros((h, w, 3), dtype=np.uint8)
    for cls_id, cls_color in enumerate(CLASS_COLORS):
        color[mask == cls_id] = cls_color
    return color


def denormalize_image(img_tensor: torch.Tensor) -> np.ndarray:
    """Convert normalized tensor back to displayable uint8 image."""
    img = img_tensor.cpu().numpy().transpose(1, 2, 0)  # CHW -> HWC
    img = img * IMAGENET_STD + IMAGENET_MEAN
    img = np.clip(img * 255, 0, 255).astype(np.uint8)
    return img


def compute_confusion_matrix(pred: np.ndarray, target: np.ndarray, num_classes: int = 7) -> np.ndarray:
    """Compute confusion matrix."""
    cm = np.zeros((num_classes, num_classes), dtype=np.int64)
    for c_true in range(num_classes):
        for c_pred in range(num_classes):
            cm[c_true, c_pred] = np.sum((target == c_true) & (pred == c_pred))
    return cm


def compute_edge_precision_recall(pred: np.ndarray, target: np.ndarray, tolerance_px: int = 3) -> dict:
    """Compute edge precision/recall with pixel tolerance.

    An edge pixel is "correct" if there's a ground truth edge pixel
    within tolerance_px Manhattan distance.
    """
    # Extract edge pixels (classes 2-6)
    pred_edge = np.isin(pred, EDGE_CLASSES)
    target_edge = np.isin(target, EDGE_CLASSES)

    if not np.any(target_edge):
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}

    # Dilate target edges by tolerance to create "acceptable" zone
    kernel = np.ones((2 * tolerance_px + 1, 2 * tolerance_px + 1), dtype=np.uint8)
    target_dilated = cv2.dilate(target_edge.astype(np.uint8), kernel) > 0
    pred_dilated = cv2.dilate(pred_edge.astype(np.uint8), kernel) > 0

    # Precision: fraction of predicted edge pixels near a ground truth edge
    pred_correct = np.sum(pred_edge & target_dilated)
    pred_total = np.sum(pred_edge)
    precision = pred_correct / pred_total if pred_total > 0 else 0.0

    # Recall: fraction of ground truth edge pixels near a predicted edge
    target_detected = np.sum(target_edge & pred_dilated)
    target_total = np.sum(target_edge)
    recall = target_detected / target_total if target_total > 0 else 0.0

    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    return {"precision": precision, "recall": recall, "f1": f1}


def main():
    parser = argparse.ArgumentParser(description="Evaluate roof edge segmentation model")
    parser.add_argument("--checkpoint", required=True, help="Model checkpoint path")
    parser.add_argument("--data-dir", default=None, help="Test data directory")
    parser.add_argument("--output-dir", default=None, help="Output directory for evaluation results")
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--gpu", type=int, default=0)
    args = parser.parse_args()

    ml_dir = Path(__file__).resolve().parent.parent
    data_dir = Path(args.data_dir) if args.data_dir else ml_dir / "data" / "test"
    output_dir = Path(args.output_dir) if args.output_dir else ml_dir / "models" / "evaluation"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Device
    device = torch.device(f"cuda:{args.gpu}" if torch.cuda.is_available() else "cpu")

    # Load checkpoint
    ckpt = torch.load(args.checkpoint, map_location=device, weights_only=False)
    config = ckpt.get("config", load_config())

    # Create model
    model = create_model(config).to(device)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    print(f"Loaded checkpoint: epoch {ckpt.get('epoch', '?')}, "
          f"best edge IoU: {ckpt.get('best_edge_iou', '?')}")

    # Dataset
    dataset = RoofEdgeDataset(str(data_dir), transform=get_val_augmentations())
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=False, num_workers=2)
    print(f"Test set: {len(dataset)} images")

    # Evaluate
    all_preds = []
    all_targets = []
    all_images = []
    all_filenames = []
    confusion_matrix = np.zeros((7, 7), dtype=np.int64)
    edge_metrics = []

    with torch.no_grad():
        for batch in tqdm(loader, desc="Evaluating"):
            images = batch["image"].to(device)
            masks = batch["mask"]

            logits = model(images)
            preds = logits.argmax(dim=1).cpu()

            for i in range(images.size(0)):
                pred_np = preds[i].numpy()
                target_np = masks[i].numpy()

                confusion_matrix += compute_confusion_matrix(pred_np, target_np)
                edge_metrics.append(compute_edge_precision_recall(pred_np, target_np))

                all_preds.append(pred_np)
                all_targets.append(target_np)
                all_images.append(batch["image"][i])
                all_filenames.append(batch["filename"][i])

    # Per-class IoU
    print(f"\n{'='*60}")
    print("Per-Class IoU:")
    class_ious = {}
    for c in range(7):
        tp = confusion_matrix[c, c]
        fp = confusion_matrix[:, c].sum() - tp
        fn = confusion_matrix[c, :].sum() - tp
        iou = tp / (tp + fp + fn) if (tp + fp + fn) > 0 else 0.0
        class_ious[CLASS_NAMES[c]] = iou
        marker = " <-- edge" if c in EDGE_CLASSES else ""
        print(f"  {CLASS_NAMES[c]:15s}: {iou:.4f}{marker}")

    edge_ious = [class_ious[CLASS_NAMES[c]] for c in EDGE_CLASSES]
    mean_iou = np.mean(list(class_ious.values()))
    edge_mean_iou = np.mean(edge_ious)
    print(f"\n  Mean IoU:      {mean_iou:.4f}")
    print(f"  Edge Mean IoU: {edge_mean_iou:.4f}")

    # Edge precision/recall
    avg_precision = np.mean([m["precision"] for m in edge_metrics])
    avg_recall = np.mean([m["recall"] for m in edge_metrics])
    avg_f1 = np.mean([m["f1"] for m in edge_metrics])
    print(f"\nEdge Detection (3px tolerance):")
    print(f"  Precision: {avg_precision:.4f}")
    print(f"  Recall:    {avg_recall:.4f}")
    print(f"  F1:        {avg_f1:.4f}")

    # Save confusion matrix
    np.save(output_dir / "confusion_matrix.npy", confusion_matrix)

    # Generate side-by-side overlays (up to 20 images)
    overlay_dir = output_dir / "overlays"
    overlay_dir.mkdir(exist_ok=True)
    n_overlays = min(20, len(all_images))

    for i in range(n_overlays):
        original = denormalize_image(all_images[i])
        gt_color = mask_to_color(all_targets[i])
        pred_color = mask_to_color(all_preds[i])

        # Side-by-side: original | ground truth | prediction
        combined = np.hstack([original, gt_color, pred_color])
        cv2.imwrite(str(overlay_dir / f"{all_filenames[i].replace('.png', '_overlay.png')}"),
                     cv2.cvtColor(combined, cv2.COLOR_RGB2BGR))

    print(f"\nOverlays saved to {overlay_dir} ({n_overlays} images)")

    # Save report
    report = {
        "checkpoint": str(args.checkpoint),
        "test_images": len(dataset),
        "class_ious": class_ious,
        "mean_iou": float(mean_iou),
        "edge_mean_iou": float(edge_mean_iou),
        "edge_precision": float(avg_precision),
        "edge_recall": float(avg_recall),
        "edge_f1": float(avg_f1),
        "confusion_matrix": confusion_matrix.tolist(),
    }
    with open(output_dir / "evaluation_report.json", "w") as f:
        json.dump(report, f, indent=2)

    print(f"Report saved to {output_dir / 'evaluation_report.json'}")

    # Quality assessment
    targets = config.get("targets", {})
    print(f"\n{'='*60}")
    if edge_mean_iou >= targets.get("production_edge_iou", 0.65):
        print("PRODUCTION READY")
    elif edge_mean_iou >= targets.get("usable_edge_iou", 0.50):
        print("USABLE — continue collecting data")
    elif edge_mean_iou >= targets.get("initial_edge_iou", 0.30):
        print("INITIAL — needs more training data")
    else:
        print("BELOW THRESHOLD — collect more diverse annotations")


if __name__ == "__main__":
    main()
