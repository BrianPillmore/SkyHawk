"""
export_onnx.py — Export trained PyTorch model to ONNX format.

Validates ONNX output matches PyTorch output within tolerance.

Usage:
    python export_onnx.py --checkpoint ../models/best.pth [--output ../models/roof_edge_detector.onnx]
"""

import argparse
from pathlib import Path

import numpy as np
import torch

from model import create_model, load_config


def export_to_onnx(checkpoint_path: str, output_path: str, opset_version: int = 17):
    """Export PyTorch model to ONNX."""
    # Load checkpoint
    device = torch.device("cpu")
    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
    config = ckpt.get("config", load_config())

    # Create model and load weights
    model = create_model(config)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    # Dummy input
    dummy_input = torch.randn(1, 3, 640, 640)

    # Get PyTorch output for validation
    with torch.no_grad():
        torch_output = model(dummy_input).numpy()

    # Export
    print(f"Exporting to ONNX (opset {opset_version})...")
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        input_names=["image"],
        output_names=["segmentation"],
        opset_version=opset_version,
        dynamic_axes={
            "image": {0: "batch_size"},
            "segmentation": {0: "batch_size"},
        },
    )

    print(f"ONNX model saved to: {output_path}")

    # Validate ONNX output
    try:
        import onnxruntime as ort

        session = ort.InferenceSession(output_path)
        onnx_output = session.run(None, {"image": dummy_input.numpy()})[0]

        max_diff = np.abs(torch_output - onnx_output).max()
        mean_diff = np.abs(torch_output - onnx_output).mean()
        print(f"\nValidation:")
        print(f"  Max difference:  {max_diff:.2e}")
        print(f"  Mean difference: {mean_diff:.2e}")

        if max_diff < 1e-4:
            print("  PASS: ONNX output matches PyTorch within tolerance")
        else:
            print("  WARNING: Larger than expected difference — check for issues")

    except ImportError:
        print("\nSkipping ONNX validation (onnxruntime not installed)")

    # Report model size
    import os
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\nModel size: {size_mb:.1f} MB")

    return output_path


def main():
    parser = argparse.ArgumentParser(description="Export model to ONNX")
    parser.add_argument("--checkpoint", required=True, help="PyTorch checkpoint path")
    parser.add_argument("--output", default=None, help="ONNX output path")
    parser.add_argument("--opset", type=int, default=17, help="ONNX opset version")
    args = parser.parse_args()

    if args.output is None:
        ml_dir = Path(__file__).resolve().parent.parent
        args.output = str(ml_dir / "models" / "roof_edge_detector.onnx")

    export_to_onnx(args.checkpoint, args.output, args.opset)


if __name__ == "__main__":
    main()
