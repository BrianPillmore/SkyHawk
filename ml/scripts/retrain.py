"""
retrain.py — Fine-tune model from corrections (active learning).

Loads existing training set + correction pairs, fine-tunes from
latest checkpoint with lower learning rate. Correction pairs are
weighted higher (they represent model weaknesses).

Usage:
    python retrain.py --checkpoint ../models/best.pth
                      [--corrections-dir ../data/annotated]
                      [--output-dir ../models]
"""

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch
import yaml
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader, ConcatDataset, WeightedRandomSampler

from model import create_model, load_config, CombinedLoss
from dataset import RoofEdgeDataset, get_train_augmentations, get_val_augmentations
from train import train_epoch, validate


def main():
    parser = argparse.ArgumentParser(description="Fine-tune model from corrections")
    parser.add_argument("--checkpoint", required=True, help="Base checkpoint to fine-tune from")
    parser.add_argument("--corrections-dir", default=None, help="Directory with correction pairs")
    parser.add_argument("--output-dir", default=None, help="Output directory for new checkpoint")
    parser.add_argument("--epochs", type=int, default=50, help="Fine-tuning epochs")
    parser.add_argument("--lr", type=float, default=1e-5, help="Learning rate (lower than initial)")
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--gpu", type=int, default=0)
    args = parser.parse_args()

    ml_dir = Path(__file__).resolve().parent.parent
    corrections_dir = Path(args.corrections_dir) if args.corrections_dir else ml_dir / "data" / "corrections"
    output_dir = Path(args.output_dir) if args.output_dir else ml_dir / "models"
    output_dir.mkdir(parents=True, exist_ok=True)

    device = torch.device(f"cuda:{args.gpu}" if torch.cuda.is_available() else "cpu")

    # Load checkpoint
    ckpt = torch.load(args.checkpoint, map_location=device, weights_only=False)
    config = ckpt.get("config", load_config())

    model = create_model(config).to(device)
    model.load_state_dict(ckpt["model_state_dict"])
    print(f"Loaded base model (epoch {ckpt.get('epoch', '?')}, edge IoU {ckpt.get('best_edge_iou', '?')})")

    # Load datasets
    train_dir = ml_dir / "data" / "train"
    val_dir = ml_dir / "data" / "val"

    train_aug = get_train_augmentations(config)
    val_aug = get_val_augmentations()

    datasets = []
    weights = []

    # Original training data
    if train_dir.exists() and any(train_dir.glob("*.png")):
        orig_dataset = RoofEdgeDataset(str(train_dir), transform=train_aug)
        datasets.append(orig_dataset)
        weights.extend([1.0] * len(orig_dataset))
        print(f"Original training data: {len(orig_dataset)} images (weight: 1.0)")

    # Correction data (weighted higher)
    correction_weight = 3.0
    if corrections_dir.exists() and any(corrections_dir.glob("*.png")):
        corr_dataset = RoofEdgeDataset(str(corrections_dir), transform=train_aug)
        datasets.append(corr_dataset)
        weights.extend([correction_weight] * len(corr_dataset))
        print(f"Correction data: {len(corr_dataset)} images (weight: {correction_weight})")
    else:
        print(f"No corrections found in {corrections_dir}")

    if not datasets:
        print("ERROR: No training data found")
        return

    # Combine datasets with weighted sampling
    combined = ConcatDataset(datasets)
    sampler = WeightedRandomSampler(weights, num_samples=len(combined), replacement=True)

    train_loader = DataLoader(combined, batch_size=args.batch_size, sampler=sampler, num_workers=2, pin_memory=True)

    # Validation
    val_dataset = RoofEdgeDataset(str(val_dir), transform=val_aug)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False, num_workers=2)

    # Loss + optimizer (lower learning rate for fine-tuning)
    train_cfg = config["training"]
    criterion = CombinedLoss(
        class_weights=train_cfg["class_weights"],
        ce_weight=train_cfg["loss"]["ce_weight"],
        dice_weight=train_cfg["loss"]["dice_weight"],
    ).to(device)

    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=train_cfg["weight_decay"])
    scheduler = CosineAnnealingLR(optimizer, T_max=args.epochs)

    # Fine-tune
    best_edge_iou = ckpt.get("best_edge_iou", 0.0)
    patience = 10
    epochs_without_improvement = 0

    print(f"\nFine-tuning for {args.epochs} epochs (lr={args.lr})")
    print(f"Starting edge IoU: {best_edge_iou:.4f}")
    print(f"{'='*60}")

    for epoch in range(args.epochs):
        t0 = time.time()
        train_loss = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_ious = validate(model, val_loader, criterion, device)
        scheduler.step()

        edge_iou = val_ious["edge_mean"]
        elapsed = time.time() - t0

        print(f"Epoch {epoch+1:3d}/{args.epochs} | "
              f"Train: {train_loss:.4f} | Val: {val_loss:.4f} | "
              f"Edge mIoU: {edge_iou:.4f} | {elapsed:.1f}s")

        if edge_iou > best_edge_iou:
            best_edge_iou = edge_iou
            epochs_without_improvement = 0
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "best_edge_iou": best_edge_iou,
                "config": config,
                "source": "retrain",
            }, output_dir / "best.pth")
            print(f"  -> New best: {best_edge_iou:.4f}")
        else:
            epochs_without_improvement += 1

        if epochs_without_improvement >= patience:
            print(f"\nEarly stopping after {patience} epochs without improvement")
            break

    print(f"\n{'='*60}")
    print(f"Fine-tuning complete. Best edge mIoU: {best_edge_iou:.4f}")

    # Auto-export ONNX if improved
    if best_edge_iou > ckpt.get("best_edge_iou", 0.0):
        print("\nModel improved! Exporting new ONNX model...")
        from export_onnx import export_to_onnx
        export_to_onnx(
            str(output_dir / "best.pth"),
            str(output_dir / "roof_edge_detector.onnx"),
        )
    else:
        print("\nNo improvement over base model — keeping existing ONNX")


if __name__ == "__main__":
    main()
