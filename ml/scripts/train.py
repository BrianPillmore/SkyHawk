"""
train.py — Training loop for roof edge segmentation model.

Research-backed training pipeline:
  - LR finder (ArcGIS study) for optimal learning rate
  - Combined loss: Focal + Dice + Boundary + Topology (satellite-image-deep-learning)
  - HED-UNet dual-task training (segmentation + edge detection)
  - Sample weighting for user corrections (active learning)
  - SatlasPretrain / standard encoder support

Usage:
    python train.py [--config ../configs/model_config.yaml] [--data-dir ../data/annotated]
                    [--checkpoint-dir ../models] [--epochs 200] [--batch-size 4]
                    [--resume ../models/latest.pth] [--find-lr]
"""

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import yaml
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader, WeightedRandomSampler
from tqdm import tqdm

from model import create_model, load_config, CombinedLoss, find_learning_rate
from dataset import RoofEdgeDataset, get_train_augmentations, get_val_augmentations, split_dataset


def compute_iou(pred: torch.Tensor, target: torch.Tensor, num_classes: int = 7) -> dict:
    """Compute per-class IoU and mean IoU."""
    ious = {}
    pred_flat = pred.view(-1)
    target_flat = target.view(-1)

    for c in range(num_classes):
        pred_c = (pred_flat == c)
        target_c = (target_flat == c)
        intersection = (pred_c & target_c).sum().item()
        union = (pred_c | target_c).sum().item()
        if union > 0:
            ious[c] = intersection / union
        else:
            ious[c] = float("nan")

    valid_ious = [v for v in ious.values() if not np.isnan(v)]
    ious["mean"] = np.mean(valid_ious) if valid_ious else 0.0

    # Edge-class-only mean IoU (classes 2-6: ridge, hip, valley, eave, flashing)
    edge_ious = [ious[c] for c in range(2, 7) if not np.isnan(ious[c])]
    ious["edge_mean"] = np.mean(edge_ious) if edge_ious else 0.0

    return ious


def train_epoch(model: nn.Module, loader: DataLoader, criterion: CombinedLoss,
                optimizer: torch.optim.Optimizer, device: torch.device,
                use_edge_maps: bool = False) -> float:
    """Train for one epoch. Returns average loss."""
    model.train()
    total_loss = 0.0

    for batch in tqdm(loader, desc="  Training", leave=False):
        images = batch["image"].to(device)
        masks = batch["mask"].to(device)
        edge_maps = batch.get("edge_map")
        if edge_maps is not None:
            edge_maps = edge_maps.to(device)

        optimizer.zero_grad()
        output = model(images)

        if isinstance(output, dict) and use_edge_maps and edge_maps is not None:
            loss = criterion(output, masks, edge_targets=edge_maps)
        elif isinstance(output, dict):
            loss = criterion(output["seg"], masks)
        else:
            loss = criterion(output, masks)

        loss.backward()

        # Gradient clipping (prevents training instability)
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

        optimizer.step()
        total_loss += loss.item() * images.size(0)

    return total_loss / len(loader.dataset)


@torch.no_grad()
def validate(model: nn.Module, loader: DataLoader, criterion: CombinedLoss,
             device: torch.device) -> tuple:
    """Validate model. Returns (avg_loss, iou_dict)."""
    model.eval()
    total_loss = 0.0
    all_preds = []
    all_targets = []

    for batch in tqdm(loader, desc="  Validating", leave=False):
        images = batch["image"].to(device)
        masks = batch["mask"].to(device)

        output = model(images)

        # Extract segmentation logits (handle HED-UNet dict output)
        if isinstance(output, dict):
            logits = output["seg"]
        else:
            logits = output

        loss = criterion(logits, masks)
        total_loss += loss.item() * images.size(0)

        preds = logits.argmax(dim=1)  # [B, H, W]
        all_preds.append(preds.cpu())
        all_targets.append(masks.cpu())

    all_preds = torch.cat(all_preds)
    all_targets = torch.cat(all_targets)
    ious = compute_iou(all_preds, all_targets)

    return total_loss / len(loader.dataset), ious


def create_weighted_sampler(dataset: RoofEdgeDataset) -> WeightedRandomSampler:
    """Create weighted sampler that oversamples user corrections.

    Active learning: corrections from real users represent model weaknesses
    and should be seen more often during training.
    """
    weights = []
    for pair in dataset.pairs:
        if pair["is_correction"]:
            weights.append(3.0)  # 3x oversampling for corrections
        else:
            weights.append(1.0)

    return WeightedRandomSampler(
        weights=weights,
        num_samples=len(weights),
        replacement=True,
    )


def main():
    parser = argparse.ArgumentParser(description="Train roof edge segmentation model")
    parser.add_argument("--config", default=None, help="Config YAML path")
    parser.add_argument("--data-dir", default=None, help="Annotated data directory")
    parser.add_argument("--checkpoint-dir", default=None, help="Directory for model checkpoints")
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=None)
    parser.add_argument("--lr", type=float, default=None)
    parser.add_argument("--resume", default=None, help="Resume from checkpoint")
    parser.add_argument("--gpu", type=int, default=0, help="GPU index")
    parser.add_argument("--find-lr", action="store_true", help="Run LR finder before training")
    parser.add_argument("--mode", choices=["standard", "hed-unet", "satlas"], default=None,
                        help="Model mode override")
    args = parser.parse_args()

    # Paths
    ml_dir = Path(__file__).resolve().parent.parent
    config_path = args.config or str(ml_dir / "configs" / "model_config.yaml")
    config = load_config(config_path)

    # Override model mode if specified
    if args.mode:
        config["model"]["mode"] = args.mode

    data_dir = Path(args.data_dir) if args.data_dir else ml_dir / "data" / "annotated"
    checkpoint_dir = Path(args.checkpoint_dir) if args.checkpoint_dir else ml_dir / "models"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    # Hyperparameters
    train_cfg = config["training"]
    epochs = args.epochs or train_cfg["epochs"]
    batch_size = args.batch_size or train_cfg["batch_size"]
    lr = args.lr or train_cfg["learning_rate"]
    patience = train_cfg["early_stopping_patience"]
    use_dsm = config["model"].get("use_dsm", False)
    model_mode = config["model"].get("mode", "standard")
    use_edge_maps = model_mode == "hed-unet"

    # Device
    if torch.cuda.is_available():
        device = torch.device(f"cuda:{args.gpu}")
        print(f"Using GPU: {torch.cuda.get_device_name(device)}")
    else:
        device = torch.device("cpu")
        print("WARNING: No GPU found — training on CPU (will be very slow)")

    # Check for training data
    train_dir = ml_dir / "data" / "train"
    val_dir = ml_dir / "data" / "val"

    if not train_dir.exists() or not any(train_dir.glob("*.png")):
        print("Splitting annotated data into train/val/test...")
        split_dataset(
            str(data_dir),
            str(train_dir),
            str(val_dir),
            str(ml_dir / "data" / "test"),
            train_ratio=config["data"]["train_split"],
            val_ratio=config["data"]["val_split"],
        )

    # Datasets
    train_aug = get_train_augmentations(config)
    val_aug = get_val_augmentations()

    train_dataset = RoofEdgeDataset(
        str(train_dir), transform=train_aug,
        use_dsm=use_dsm, generate_edge_maps=use_edge_maps,
    )
    val_dataset = RoofEdgeDataset(
        str(val_dir), transform=val_aug,
        use_dsm=use_dsm, generate_edge_maps=use_edge_maps,
    )

    print(f"Model mode: {model_mode}")
    print(f"Training set: {len(train_dataset)} images")
    print(f"Validation set: {len(val_dataset)} images")
    if use_dsm:
        print("DSM channel: enabled (4-channel RGB+DSM input)")
    if use_edge_maps:
        print("HED-UNet: dual-task segmentation + edge detection")

    # Weighted sampler for active learning (oversample user corrections)
    sampler = create_weighted_sampler(train_dataset)

    train_loader = DataLoader(
        train_dataset, batch_size=batch_size, sampler=sampler,
        num_workers=2, pin_memory=True,
    )
    val_loader = DataLoader(
        val_dataset, batch_size=batch_size, shuffle=False,
        num_workers=2, pin_memory=True,
    )

    # Model
    model = create_model(config).to(device)
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Model parameters: {total_params:,} total, {trainable_params:,} trainable")

    # Loss — research-backed combined loss
    class_weights = train_cfg["class_weights"]
    loss_cfg = train_cfg.get("loss", {})

    criterion = CombinedLoss(
        class_weights=class_weights,
        focal_weight=loss_cfg.get("focal_weight", 0.3),
        dice_weight=loss_cfg.get("dice_weight", 0.3),
        boundary_weight=loss_cfg.get("boundary_weight", 0.2),
        topo_weight=loss_cfg.get("topo_weight", 0.2),
        edge_weight=loss_cfg.get("edge_weight", 0.5) if use_edge_maps else 0.0,
        focal_gamma=loss_cfg.get("focal_gamma", 2.0),
    ).to(device)

    # Optimizer
    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=train_cfg["weight_decay"])

    # LR Finder (research: ArcGIS Mask R-CNN study)
    if args.find_lr or train_cfg.get("use_lr_finder", False):
        print("\nRunning LR finder...")
        optimal_lr = find_learning_rate(model, train_loader, criterion, str(device))
        lr = optimal_lr
        # Recreate optimizer with found LR
        optimizer = AdamW(model.parameters(), lr=lr, weight_decay=train_cfg["weight_decay"])
        print(f"Using found LR: {lr:.2e}\n")

    scheduler = CosineAnnealingLR(optimizer, T_max=epochs)

    # Resume from checkpoint
    start_epoch = 0
    best_edge_iou = 0.0
    if args.resume:
        ckpt = torch.load(args.resume, map_location=device)
        model.load_state_dict(ckpt["model_state_dict"])
        optimizer.load_state_dict(ckpt["optimizer_state_dict"])
        start_epoch = ckpt.get("epoch", 0) + 1
        best_edge_iou = ckpt.get("best_edge_iou", 0.0)
        print(f"Resumed from epoch {start_epoch}, best edge IoU: {best_edge_iou:.4f}")

    # Training loop
    history = []
    epochs_without_improvement = 0

    print(f"\nTraining for {epochs} epochs (early stopping patience: {patience})")
    print(f"Loss: Focal({loss_cfg.get('focal_weight', 0.3)}) + "
          f"Dice({loss_cfg.get('dice_weight', 0.3)}) + "
          f"Boundary({loss_cfg.get('boundary_weight', 0.2)}) + "
          f"Topology({loss_cfg.get('topo_weight', 0.2)})")
    if use_edge_maps:
        print(f"  + Edge BCE({loss_cfg.get('edge_weight', 0.5)})")
    print(f"{'='*70}")

    for epoch in range(start_epoch, epochs):
        t0 = time.time()

        # Train
        train_loss = train_epoch(model, train_loader, criterion, optimizer, device, use_edge_maps)

        # Validate
        val_loss, val_ious = validate(model, val_loader, criterion, device)

        scheduler.step()

        elapsed = time.time() - t0
        edge_iou = val_ious["edge_mean"]
        mean_iou = val_ious["mean"]

        print(f"Epoch {epoch+1:3d}/{epochs} | "
              f"Train loss: {train_loss:.4f} | Val loss: {val_loss:.4f} | "
              f"mIoU: {mean_iou:.4f} | Edge mIoU: {edge_iou:.4f} | "
              f"{elapsed:.1f}s")

        # Record history
        epoch_record = {
            "epoch": epoch + 1,
            "train_loss": train_loss,
            "val_loss": val_loss,
            "mean_iou": mean_iou,
            "edge_mean_iou": edge_iou,
            "per_class_iou": {str(k): v for k, v in val_ious.items() if isinstance(k, int)},
            "lr": optimizer.param_groups[0]["lr"],
        }
        history.append(epoch_record)

        # Save best model
        if edge_iou > best_edge_iou:
            best_edge_iou = edge_iou
            epochs_without_improvement = 0

            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "best_edge_iou": best_edge_iou,
                "config": config,
            }, checkpoint_dir / "best.pth")
            print(f"  -> New best edge mIoU: {best_edge_iou:.4f}")
        else:
            epochs_without_improvement += 1

        # Save latest checkpoint
        torch.save({
            "epoch": epoch,
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "best_edge_iou": best_edge_iou,
            "config": config,
        }, checkpoint_dir / "latest.pth")

        # Early stopping
        if epochs_without_improvement >= patience:
            print(f"\nEarly stopping: no improvement for {patience} epochs")
            break

    # Save training history
    with open(checkpoint_dir / "training_history.json", "w") as f:
        json.dump(history, f, indent=2)

    print(f"\n{'='*70}")
    print(f"Training complete. Best edge mIoU: {best_edge_iou:.4f}")
    print(f"Checkpoints saved to: {checkpoint_dir}")

    # Check against targets
    targets = config.get("targets", {})
    if best_edge_iou >= targets.get("production_edge_iou", 0.65):
        print("Production-ready model!")
    elif best_edge_iou >= targets.get("usable_edge_iou", 0.50):
        print("Usable model — continue collecting data for improvement")
    elif best_edge_iou >= targets.get("initial_edge_iou", 0.30):
        print("Initial model — needs more training data")
    else:
        print("Below minimum threshold — collect more diverse annotations")


if __name__ == "__main__":
    main()
