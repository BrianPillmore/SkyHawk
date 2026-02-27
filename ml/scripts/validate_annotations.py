"""
validate_annotations.py — Validate annotation quality for ML training.

Checks:
- Image dimensions (640x640)
- Mask dimensions match image
- Pixel values in range 0-6
- Minimum edge pixel coverage
- Class distribution summary

Usage:
    python validate_annotations.py [--dir ../data/annotated]
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("ERROR: Install dependencies: pip install Pillow numpy")
    sys.exit(1)


CLASS_NAMES = {
    0: "background",
    1: "roof_surface",
    2: "ridge",
    3: "hip",
    4: "valley",
    5: "eave_rake",
    6: "flashing",
}

EDGE_CLASSES = {2, 3, 4, 5, 6}  # non-background, non-roof-surface


def validate_annotation(img_path: Path, mask_path: Path) -> dict:
    """Validate a single image+mask pair."""
    errors = []
    warnings = []

    # Load image
    img = Image.open(img_path)
    if img.size != (640, 640):
        errors.append(f"Image size {img.size}, expected (640, 640)")

    # Load mask
    mask = Image.open(mask_path)
    if mask.size != (640, 640):
        errors.append(f"Mask size {mask.size}, expected (640, 640)")

    # Mask must be single-channel (mode 'L' or 'P')
    if mask.mode not in ("L", "P"):
        errors.append(f"Mask mode '{mask.mode}', expected 'L' (grayscale)")

    mask_arr = np.array(mask)
    total_pixels = mask_arr.size

    # Check pixel value range
    min_val, max_val = mask_arr.min(), mask_arr.max()
    if min_val < 0 or max_val > 6:
        errors.append(f"Pixel values out of range: min={min_val}, max={max_val} (expected 0-6)")

    # Class distribution
    class_counts = {}
    for cls_id in range(7):
        count = int(np.sum(mask_arr == cls_id))
        class_counts[CLASS_NAMES[cls_id]] = count

    # Edge pixel coverage
    edge_pixels = sum(
        int(np.sum(mask_arr == cls_id)) for cls_id in EDGE_CLASSES
    )
    edge_pct = (edge_pixels / total_pixels) * 100

    if edge_pixels == 0:
        errors.append("No edge pixels found — annotation contains only background/roof surface")
    elif edge_pct < 0.5:
        warnings.append(f"Very low edge coverage: {edge_pct:.2f}% (typical: 1-5%)")

    # Roof surface coverage
    roof_pixels = class_counts.get("roof_surface", 0)
    roof_pct = (roof_pixels / total_pixels) * 100
    if roof_pct < 5:
        warnings.append(f"Low roof surface coverage: {roof_pct:.1f}%")

    return {
        "image": img_path.name,
        "mask": mask_path.name,
        "image_size": img.size,
        "mask_size": mask.size,
        "class_distribution": class_counts,
        "edge_pixel_pct": round(edge_pct, 3),
        "roof_pixel_pct": round(roof_pct, 1),
        "errors": errors,
        "warnings": warnings,
        "valid": len(errors) == 0,
    }


def find_pairs(directory: Path) -> list:
    """Find image+mask pairs in directory. Masks have '_mask' suffix."""
    pairs = []
    for img_file in sorted(directory.glob("*.png")):
        if "_mask" in img_file.name:
            continue
        mask_file = directory / img_file.name.replace(".png", "_mask.png")
        if mask_file.exists():
            pairs.append((img_file, mask_file))
        else:
            print(f"WARNING: No mask for {img_file.name}")
    return pairs


def main():
    parser = argparse.ArgumentParser(description="Validate ML training annotations")
    parser.add_argument("--dir", default=None, help="Annotations directory (default: ml/data/annotated)")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    ml_dir = script_dir.parent
    ann_dir = Path(args.dir) if args.dir else ml_dir / "data" / "annotated"

    if not ann_dir.exists():
        print(f"ERROR: Directory not found: {ann_dir}")
        sys.exit(1)

    pairs = find_pairs(ann_dir)
    if not pairs:
        print(f"No image+mask pairs found in {ann_dir}")
        print("  Expected: <name>.png + <name>_mask.png")
        sys.exit(1)

    print(f"Validating {len(pairs)} annotation pairs in {ann_dir}\n")

    results = []
    total_valid = 0
    total_class_counts = {name: 0 for name in CLASS_NAMES.values()}

    for img_path, mask_path in pairs:
        result = validate_annotation(img_path, mask_path)
        results.append(result)

        status = "PASS" if result["valid"] else "FAIL"
        print(f"  [{status}] {result['image']}: "
              f"edges={result['edge_pixel_pct']:.2f}%, roof={result['roof_pixel_pct']:.1f}%")

        if result["errors"]:
            for err in result["errors"]:
                print(f"    ERROR: {err}")
        if result["warnings"]:
            for warn in result["warnings"]:
                print(f"    WARN: {warn}")

        if result["valid"]:
            total_valid += 1
            for cls_name, count in result["class_distribution"].items():
                total_class_counts[cls_name] += count

    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY: {total_valid}/{len(pairs)} valid annotations")
    print(f"\nAggregate class distribution (across valid annotations):")
    total_px = sum(total_class_counts.values())
    if total_px > 0:
        for cls_name, count in total_class_counts.items():
            pct = (count / total_px) * 100
            bar = "#" * int(pct / 2)
            print(f"  {cls_name:15s}: {pct:6.2f}% {bar}")

    # Save report
    report_path = ann_dir / "validation_report.json"
    with open(report_path, "w") as f:
        json.dump({"total": len(pairs), "valid": total_valid, "results": results}, f, indent=2)
    print(f"\nReport saved to {report_path}")


if __name__ == "__main__":
    main()
