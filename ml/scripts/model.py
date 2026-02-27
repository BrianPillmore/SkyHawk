"""
model.py — U-Net + ResNet-50 for roof edge semantic segmentation.

Architecture:
- Encoder: ResNet-50 pretrained on ImageNet (transfer learning)
- Decoder: U-Net with skip connections (sharp pixel-level boundaries)
- Input: [B, 3, 640, 640] RGB float32
- Output: [B, 7, 640, 640] class logits (7 classes)

Classes:
  0: background
  1: roof_surface
  2: ridge
  3: hip
  4: valley
  5: eave_rake
  6: flashing
"""

import yaml
from pathlib import Path

import segmentation_models_pytorch as smp
import torch
import torch.nn as nn


def load_config(config_path: str = None) -> dict:
    """Load model configuration from YAML."""
    if config_path is None:
        config_path = Path(__file__).resolve().parent.parent / "configs" / "model_config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


def create_model(config: dict = None) -> nn.Module:
    """Create U-Net model with ResNet-50 encoder."""
    if config is None:
        config = load_config()

    model_cfg = config["model"]
    model = smp.Unet(
        encoder_name=model_cfg["encoder"],
        encoder_weights=model_cfg["encoder_weights"],
        in_channels=model_cfg["in_channels"],
        classes=model_cfg["classes"],
        activation=None,  # raw logits — softmax applied in loss/inference
    )
    return model


class CombinedLoss(nn.Module):
    """Weighted Cross-Entropy + Dice Loss.

    CE handles per-pixel classification.
    Dice prevents class imbalance collapse (edge classes are <2% of pixels).
    """

    def __init__(self, class_weights: list, ce_weight: float = 0.5, dice_weight: float = 0.5):
        super().__init__()
        self.ce_weight = ce_weight
        self.dice_weight = dice_weight
        self.ce_loss = nn.CrossEntropyLoss(
            weight=torch.tensor(class_weights, dtype=torch.float32)
        )

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        """
        Args:
            logits: [B, C, H, W] raw model output
            targets: [B, H, W] integer class labels (0-6)
        """
        # Cross-entropy loss
        ce = self.ce_loss(logits, targets)

        # Dice loss (per-class, then averaged)
        probs = torch.softmax(logits, dim=1)  # [B, C, H, W]
        num_classes = logits.shape[1]
        dice_sum = 0.0

        for c in range(num_classes):
            pred_c = probs[:, c]  # [B, H, W]
            target_c = (targets == c).float()  # [B, H, W]
            intersection = (pred_c * target_c).sum()
            union = pred_c.sum() + target_c.sum()
            dice_sum += 1.0 - (2.0 * intersection + 1e-6) / (union + 1e-6)

        dice = dice_sum / num_classes

        return self.ce_weight * ce + self.dice_weight * dice

    def to(self, device):
        """Move loss function (including CE weights) to device."""
        super().to(device)
        self.ce_loss = self.ce_loss.to(device)
        return self


if __name__ == "__main__":
    config = load_config()
    model = create_model(config)

    # Print model summary
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Model: U-Net + {config['model']['encoder']}")
    print(f"Total parameters: {total_params:,}")
    print(f"Trainable parameters: {trainable_params:,}")

    # Test forward pass
    dummy = torch.randn(1, 3, 640, 640)
    with torch.no_grad():
        out = model(dummy)
    print(f"Input shape:  {dummy.shape}")
    print(f"Output shape: {out.shape}")
    print(f"Output range: [{out.min():.3f}, {out.max():.3f}]")
