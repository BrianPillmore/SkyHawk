"""
auto_annotate.py — Auto-generate initial annotation masks using OpenStreetMap building footprints.

Research-backed approach (see: Omdena rooftop ML, SpaceNet building footprints):
  - Training first on high-volume auto-labeled data (OSM footprints), then fine-tuning
    on manually corrected data improved IoU from 0.48 → 0.66 in published research.
  - These are "silver standard" annotations — not perfect, but good enough to bootstrap.

Pipeline per image:
  1. Load satellite image + metadata (geographic bounds)
  2. Query Overpass API for OSM building footprints within those bounds
  3. Rasterize building polygons → roof surface (class 1)
  4. Extract polygon outlines → eave/rake edges (class 5)
  5. Run Canny edge detection inside roof regions → interior edge candidates (class 2)
  6. Save mask to ml/data/annotated/<name>.png + <name>_mask.png

Classes (matching model.py):
  0 = background
  1 = roof surface
  2 = ridge (interior edge candidate)
  3 = hip (not auto-detected — requires manual correction)
  4 = valley (not auto-detected — requires manual correction)
  5 = eave/rake (building outline edges)
  6 = flashing (not auto-detected — requires manual correction)

Usage:
    pip install numpy Pillow opencv-python-headless requests
    python ml/scripts/auto_annotate.py [--force] [--output ml/data/annotated]
"""

import argparse
import json
import math
import os
import shutil
import sys
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError

try:
    import numpy as np
    from PIL import Image, ImageDraw
except ImportError:
    print("ERROR: numpy and Pillow are required.")
    print("  pip install numpy Pillow")
    sys.exit(1)

try:
    import cv2
except ImportError:
    print("WARNING: opencv-python-headless not installed. Interior edge detection disabled.")
    print("  pip install opencv-python-headless")
    cv2 = None


# ── Constants ──────────────────────────────────────────────────────────────────
CLASS_BG = 0
CLASS_ROOF = 1
CLASS_RIDGE = 2
CLASS_HIP = 3
CLASS_VALLEY = 4
CLASS_EAVE = 5
CLASS_FLASHING = 6

EDGE_LINE_WIDTH = 3  # pixels — matches annotation tool spec
OVERPASS_URL = "https://overpass-api.de/api/interpreter"


# ── Geographic utilities ───────────────────────────────────────────────────────

def latlng_to_pixel(lat: float, lng: float, bounds: dict, size: int = 640) -> tuple:
    """Convert lat/lng to pixel coordinates within image bounds."""
    x = (lng - bounds["west"]) / (bounds["east"] - bounds["west"]) * size
    y = (bounds["north"] - lat) / (bounds["north"] - bounds["south"]) * size
    return (int(round(x)), int(round(y)))


def query_overpass_buildings(bounds: dict, timeout: int = 25) -> list:
    """
    Query OpenStreetMap Overpass API for building footprints within bounds.
    Returns list of polygons, each polygon is a list of (lat, lng) tuples.
    """
    # Overpass uses (south, west, north, east) bbox format
    bbox = f"{bounds['south']},{bounds['west']},{bounds['north']},{bounds['east']}"

    query = f"""
    [out:json][timeout:{timeout}];
    (
      way["building"]({bbox});
      relation["building"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """

    import urllib.parse
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = Request(OVERPASS_URL, data=data)
    req.add_header("User-Agent", "SkyHawk-ML-Training/1.0")

    try:
        with urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"    Overpass API error: {e}")
        return []

    # Build node lookup
    nodes = {}
    for elem in result.get("elements", []):
        if elem["type"] == "node":
            nodes[elem["id"]] = (elem["lat"], elem["lon"])

    # Extract building polygons
    polygons = []
    for elem in result.get("elements", []):
        if elem["type"] == "way" and "nodes" in elem:
            coords = []
            for nid in elem["nodes"]:
                if nid in nodes:
                    coords.append(nodes[nid])
            if len(coords) >= 3:
                polygons.append(coords)

    return polygons


# ── Mask generation ────────────────────────────────────────────────────────────

def rasterize_buildings(polygons: list, bounds: dict, size: int = 640) -> np.ndarray:
    """
    Rasterize OSM building polygons onto a mask.
    Returns a uint8 mask with class labels.
    """
    mask = np.zeros((size, size), dtype=np.uint8)

    if not polygons:
        return mask

    # Create PIL image for polygon fill (roof surface)
    roof_img = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(roof_img)

    for polygon in polygons:
        # Convert lat/lng to pixel coordinates
        pixel_coords = []
        for lat, lng in polygon:
            px, py = latlng_to_pixel(lat, lng, bounds, size)
            pixel_coords.append((px, py))

        if len(pixel_coords) < 3:
            continue

        # Fill polygon as roof surface (class 1)
        draw.polygon(pixel_coords, fill=CLASS_ROOF)

        # Draw polygon outline as eave/rake (class 5) — 3px wide
        draw.line(pixel_coords + [pixel_coords[0]], fill=CLASS_EAVE, width=EDGE_LINE_WIDTH)

    mask = np.array(roof_img)
    return mask


def detect_interior_edges(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """
    Use Canny edge detection within roof regions to find interior edges.
    These become ridge candidates (class 2).

    Research note: This is the weakest part of auto-annotation. Interior edges
    (ridges, hips, valleys) are subtle shadow/color transitions. Canny finds
    many false positives. The user MUST manually correct these.
    """
    if cv2 is None:
        return mask

    output = mask.copy()

    # Convert to grayscale if needed
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    else:
        gray = image.copy()

    # Create roof-only region
    roof_region = (mask == CLASS_ROOF).astype(np.uint8)

    # Erode roof region slightly to avoid detecting outline edges
    kernel = np.ones((7, 7), np.uint8)
    roof_interior = cv2.erode(roof_region, kernel, iterations=1)

    # Apply bilateral filter to reduce noise while preserving edges
    blurred = cv2.bilateralFilter(gray, 9, 75, 75)

    # Canny edge detection with moderate thresholds
    edges = cv2.Canny(blurred, 30, 100)

    # Only keep edges inside roof interior
    interior_edges = edges & (roof_interior * 255)

    # Dilate edges slightly to match 3px line width
    edge_kernel = np.ones((EDGE_LINE_WIDTH, EDGE_LINE_WIDTH), np.uint8)
    interior_edges = cv2.dilate(interior_edges, edge_kernel, iterations=1)

    # Filter out small edge fragments (noise)
    # Find connected components, remove those with < 20 pixels
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(interior_edges, connectivity=8)
    for label_id in range(1, num_labels):
        area = stats[label_id, cv2.CC_STAT_AREA]
        if area < 20:
            interior_edges[labels == label_id] = 0

    # Mark interior edges as ridge candidates (class 2)
    # Don't overwrite existing eave/rake edges (class 5)
    ridge_pixels = (interior_edges > 0) & (output != CLASS_EAVE)
    output[ridge_pixels] = CLASS_RIDGE

    return output


# ── Main pipeline ──────────────────────────────────────────────────────────────

def process_image(raw_dir: Path, output_dir: Path, slug: str, force: bool = False) -> bool:
    """Process a single raw image → annotated image + mask pair."""
    img_path = raw_dir / f"{slug}.png"
    meta_path = raw_dir / f"{slug}.json"

    out_img_path = output_dir / f"{slug}.png"
    out_mask_path = output_dir / f"{slug}_mask.png"

    if out_mask_path.exists() and not force:
        print(f"  SKIP (exists): {out_mask_path.name}")
        return True

    # Load metadata
    if not meta_path.exists():
        print(f"  SKIP (no metadata): {slug}")
        return False

    with open(meta_path) as f:
        meta = json.load(f)

    bounds = meta["bounds"]

    # Load image
    if not img_path.exists():
        print(f"  SKIP (no image): {slug}")
        return False

    image = np.array(Image.open(img_path).convert("RGB"))
    size = image.shape[0]  # Should be 640

    # Step 1: Query OSM building footprints
    print(f"  Querying OSM for buildings...")
    polygons = query_overpass_buildings(bounds)
    print(f"  Found {len(polygons)} building footprints")

    # Step 2: Rasterize buildings → roof surface + outline edges
    mask = rasterize_buildings(polygons, bounds, size)

    roof_pixels = np.sum(mask == CLASS_ROOF) + np.sum(mask == CLASS_EAVE)
    roof_pct = roof_pixels / (size * size) * 100
    print(f"  Roof coverage: {roof_pct:.1f}% of image")

    if roof_pct < 0.5:
        print(f"  WARNING: Very low roof coverage — coordinates may be off")

    # Step 3: Interior edge detection (ridge candidates)
    if cv2 is not None and roof_pct > 0.5:
        print(f"  Detecting interior edges...")
        mask = detect_interior_edges(image, mask)
        ridge_pixels = np.sum(mask == CLASS_RIDGE)
        print(f"  Found {ridge_pixels} ridge candidate pixels")

    # Step 4: Save results
    # Copy source image to annotated dir
    shutil.copy2(img_path, out_img_path)

    # Save mask as single-channel PNG (pixel values 0-6)
    mask_img = Image.fromarray(mask, mode="L")
    mask_img.save(out_mask_path)

    print(f"  SAVED: {out_img_path.name} + {out_mask_path.name}")

    # Print class distribution
    for cls_id, cls_name in [(0, "bg"), (1, "roof"), (2, "ridge"), (5, "eave")]:
        count = np.sum(mask == cls_id)
        pct = count / (size * size) * 100
        if count > 0:
            print(f"    class {cls_id} ({cls_name}): {count:,} px ({pct:.1f}%)")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Auto-generate annotation masks from OSM building footprints"
    )
    parser.add_argument("--raw-dir", default=None, help="Raw images directory (default: ml/data/raw)")
    parser.add_argument("--output", default=None, help="Output directory (default: ml/data/annotated)")
    parser.add_argument("--force", action="store_true", help="Overwrite existing annotations")
    parser.add_argument("--slugs", nargs="*", help="Only process these slugs (default: all)")
    args = parser.parse_args()

    # Resolve directories
    script_dir = Path(__file__).resolve().parent
    ml_dir = script_dir.parent
    raw_dir = Path(args.raw_dir) if args.raw_dir else ml_dir / "data" / "raw"
    output_dir = Path(args.output) if args.output else ml_dir / "data" / "annotated"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all raw images
    if args.slugs:
        slugs = args.slugs
    else:
        slugs = sorted(set(
            p.stem for p in raw_dir.glob("*.json")
            if p.stem != ".gitkeep"
        ))

    print(f"Auto-annotating {len(slugs)} images")
    print(f"  Raw dir:    {raw_dir}")
    print(f"  Output dir: {output_dir}")
    print(f"  OSM Overpass API: {OVERPASS_URL}")
    print()

    success = 0
    errors = 0

    for i, slug in enumerate(slugs, 1):
        print(f"[{i}/{len(slugs)}] {slug}")
        try:
            ok = process_image(raw_dir, output_dir, slug, args.force)
            if ok:
                success += 1
            else:
                errors += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            errors += 1

        # Rate limit Overpass API requests
        if i < len(slugs):
            time.sleep(1.0)

    print(f"\nDone. {success} succeeded, {errors} failed/skipped.")
    print(f"Annotated images saved to {output_dir}")
    print()
    print("IMPORTANT: These are auto-generated 'silver standard' annotations.")
    print("Interior edges (ridges, hips, valleys) need manual correction.")
    print("Use the SkyHawk AnnotationTool or CVAT to review and correct.")


if __name__ == "__main__":
    main()
