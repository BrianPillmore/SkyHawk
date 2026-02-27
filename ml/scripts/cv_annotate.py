"""
cv_annotate.py — Computer vision auto-annotation for satellite roof images.

Unlike auto_annotate.py (which queries OSM and found almost nothing in suburban OK),
this script analyzes the actual satellite image pixels to detect roofs and edges.

Pipeline per image:
  1. Color segmentation: separate roof-colored pixels from vegetation/road/shadow
  2. Morphological cleanup: fill holes, remove noise
  3. Contour detection: identify individual roof polygons
  4. Outline → eave/rake edges (class 5)
  5. Interior Canny edges within each roof → ridge/hip candidates (class 2)
  6. Roof fill → roof surface (class 1)

This produces "silver standard" annotations. The user should review and correct
edge types (ridge vs hip vs valley) using the AnnotationTool or CVAT.

Usage:
    python ml/scripts/cv_annotate.py [--force] [--visualize]
"""

import argparse
import json
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

# ── Constants ──────────────────────────────────────────────────────────────────
CLASS_BG = 0
CLASS_ROOF = 1
CLASS_RIDGE = 2
CLASS_HIP = 3
CLASS_VALLEY = 4
CLASS_EAVE = 5
CLASS_FLASHING = 6
EDGE_WIDTH = 3
IMAGE_SIZE = 640


def detect_roof_regions(image_bgr: np.ndarray) -> np.ndarray:
    """Detect roof regions using color segmentation in HSV + LAB space.

    Roofs in satellite imagery are typically:
    - Gray/brown/tan (shingles) — low saturation, medium-high value
    - Blue/dark gray (metal/slate) — medium saturation, lower value
    - Red/terracotta — high saturation in red hue range

    NOT roofs:
    - Green (vegetation) — high saturation, green hue
    - Dark (shadows, deep vegetation) — very low value
    - White/bright (concrete driveways, clouds) — very high value, low saturation
    """
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    h, s, v = cv2.split(hsv)
    l_ch, a_ch, b_ch = cv2.split(lab)

    # Vegetation mask: green hue + decent saturation
    vegetation = ((h >= 25) & (h <= 90) & (s > 30) & (v > 40)).astype(np.uint8)

    # Shadow mask: very dark
    shadow = (v < 40).astype(np.uint8)

    # Road/concrete: very low saturation + medium-high brightness
    road = ((s < 25) & (v > 140) & (v < 230)).astype(np.uint8)

    # Sky/cloud: very bright
    sky = (v > 235).astype(np.uint8)

    # Non-roof mask
    non_roof = np.clip(vegetation + shadow + road + sky, 0, 1)

    # Potential roof: everything that's not vegetation, shadow, road, or sky
    potential_roof = (1 - non_roof).astype(np.uint8)

    # Apply morphological operations to clean up
    kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    kernel_medium = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))

    # Remove small noise
    potential_roof = cv2.morphologyEx(potential_roof, cv2.MORPH_OPEN, kernel_small)
    # Fill small holes
    potential_roof = cv2.morphologyEx(potential_roof, cv2.MORPH_CLOSE, kernel_medium)

    # Edge-based refinement: use Canny to find strong edges,
    # then use them to separate adjacent roofs
    edges = cv2.Canny(gray, 50, 150)
    edges_dilated = cv2.dilate(edges, np.ones((2, 2), np.uint8))

    # Use watershed or connected components to split touching roofs
    # First, find sure foreground (eroded roof regions)
    sure_fg = cv2.erode(potential_roof, kernel_medium, iterations=2)

    # Distance transform for watershed markers
    dist = cv2.distanceTransform(potential_roof, cv2.DIST_L2, 5)
    _, sure_fg_dt = cv2.threshold(dist, 0.3 * dist.max(), 1, cv2.THRESH_BINARY)
    sure_fg_dt = sure_fg_dt.astype(np.uint8)

    # Combine both foreground estimates
    sure_fg_combined = cv2.bitwise_or(sure_fg, sure_fg_dt)

    return potential_roof, sure_fg_combined


def extract_roof_contours(roof_mask: np.ndarray, min_area: int = 800) -> list:
    """Find individual roof contours from the binary mask.

    Filters out contours that are too small (noise) or have the wrong shape.
    min_area=800 roughly corresponds to a 30x30 pixel region.
    """
    contours, _ = cv2.findContours(roof_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    valid_contours = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        # Filter by aspect ratio — roofs are roughly square/rectangular
        x, y, w, h = cv2.boundingRect(cnt)
        aspect = max(w, h) / (min(w, h) + 1)
        if aspect > 6:  # Very elongated → probably not a roof
            continue

        # Filter by solidity — roofs are relatively solid shapes
        hull = cv2.convexHull(cnt)
        hull_area = cv2.contourArea(hull)
        if hull_area > 0:
            solidity = area / hull_area
            if solidity < 0.3:  # Very irregular → probably not a roof
                continue

        valid_contours.append(cnt)

    return valid_contours


def detect_interior_edges(image_bgr: np.ndarray, roof_mask: np.ndarray) -> np.ndarray:
    """Detect interior edges within roof regions (ridge/hip/valley candidates).

    Uses Canny edge detection with adaptive thresholds per roof region.
    Interior edges are where the roof changes slope — visible as subtle
    shadow lines or color transitions in satellite imagery.
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    edge_mask = np.zeros_like(gray)

    # Erode roof mask to avoid outline contamination
    eroded = cv2.erode(roof_mask, np.ones((10, 10), np.uint8), iterations=1)

    # Apply bilateral filter to preserve edges while reducing noise
    filtered = cv2.bilateralFilter(gray, 9, 50, 50)

    # Multi-scale Canny for different edge strengths
    edges_strong = cv2.Canny(filtered, 40, 120)
    edges_weak = cv2.Canny(filtered, 20, 60)

    # Combine: prefer strong edges, fill with weak where needed
    combined = cv2.bitwise_or(edges_strong, edges_weak // 2)

    # Only keep edges inside eroded roof regions
    interior = cv2.bitwise_and(combined, combined, mask=eroded)

    # Morphological operations to clean up
    # Dilate to connect nearby edge fragments
    interior = cv2.dilate(interior, np.ones((2, 2), np.uint8))
    # Erode back to approximate thinning (MORPH_THIN unavailable in headless builds)
    interior = cv2.erode(interior, np.ones((2, 2), np.uint8))

    # Filter out small fragments (< 15 pixels)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(interior, connectivity=8)
    for label_id in range(1, num_labels):
        if stats[label_id, cv2.CC_STAT_AREA] < 15:
            interior[labels == label_id] = 0

    return interior


def classify_roof_type(contour: np.ndarray) -> str:
    """Classify roof type from contour geometry.

    Uses aspect ratio, rectangularity, vertex count, and corner analysis
    to determine the most likely roof type.

    Returns: 'gable', 'hip', 'cross', 'flat', or 'complex'
    """
    area = cv2.contourArea(contour)
    if area < 400:
        return "flat"

    # Minimum bounding rectangle
    rect = cv2.minAreaRect(contour)
    rect_w, rect_h = rect[1]
    if rect_w < 1 or rect_h < 1:
        return "flat"

    # Rectangularity: how close to a perfect rectangle
    rect_area = rect_w * rect_h
    rectangularity = area / rect_area if rect_area > 0 else 0

    # Convex hull analysis
    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    solidity = area / hull_area if hull_area > 0 else 0

    # Approximate polygon — count significant vertices
    perimeter = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
    n_vertices = len(approx)

    # Aspect ratio of bounding rect
    aspect = max(rect_w, rect_h) / min(rect_w, rect_h)

    # Classification heuristics:
    #
    # Gable: rectangular (high rectangularity), elongated (aspect > 1.3)
    #   Interior edges: single ridge line parallel to long axis
    #
    # Hip: slightly less rectangular (clipped corners create trapezoid),
    #   6-8 vertices when approximated, moderate aspect ratio
    #   Interior edges: ridge + diagonal hips from ridge ends to corners
    #
    # Cross/L-shape: low rectangularity (doesn't fit a rectangle well),
    #   high vertex count (8+), often L or T shaped
    #   Interior edges: ridges + valleys at intersection
    #
    # Flat/shed: nearly square (aspect ~1), high rectangularity

    if rectangularity > 0.88 and aspect < 1.3:
        return "flat"  # Nearly square, very rectangular → flat or simple shed

    if rectangularity > 0.82 and aspect >= 1.3:
        return "gable"  # Elongated rectangle → gable

    if 0.70 <= rectangularity <= 0.85 and n_vertices <= 8:
        return "hip"  # Slightly irregular, few vertices → hip (clipped corners)

    if rectangularity < 0.70 or n_vertices >= 8:
        return "cross"  # Very irregular or many vertices → cross-gable/complex

    if solidity < 0.75:
        return "cross"  # Low solidity = concavities → L/T shape

    return "hip"  # Default for ambiguous shapes


def classify_edge_components(
    interior_edges: np.ndarray,
    contour: np.ndarray,
    roof_type: str,
) -> np.ndarray:
    """Classify each interior edge component as ridge, hip, or valley.

    Uses the roof type + edge orientation relative to the roof's principal axis:
      - Ridge: parallel to long axis (within 20°), near center
      - Hip: diagonal (~30-60° from long axis), extends from ridge toward corners
      - Valley: at intersections of two roof sections (cross-gable)

    Returns a mask where each pixel has class 2 (ridge), 3 (hip), or 4 (valley).
    """
    h, w = interior_edges.shape
    classified = np.zeros((h, w), dtype=np.uint8)

    # Get principal axis of the roof contour
    rect = cv2.minAreaRect(contour)
    center = rect[0]
    rect_w, rect_h = rect[1]
    angle = rect[2]  # degrees

    # minAreaRect angle convention: angle of the first edge from horizontal
    # We want the long axis angle
    if rect_w < rect_h:
        long_axis_angle = angle + 90
    else:
        long_axis_angle = angle

    # Normalize to 0-180
    long_axis_angle = long_axis_angle % 180

    # Find connected components of interior edges
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        interior_edges, connectivity=8
    )

    for label_id in range(1, num_labels):
        # Get pixels for this component
        component_mask = (labels == label_id).astype(np.uint8)
        component_pixels = np.argwhere(component_mask > 0)  # [row, col]

        if len(component_pixels) < 5:
            # Too small to classify reliably → default to ridge
            classified[component_mask > 0] = CLASS_RIDGE
            continue

        # PCA to get component's principal direction
        pts = component_pixels.astype(np.float32)
        mean_pt = pts.mean(axis=0)
        centered = pts - mean_pt

        # Covariance matrix for PCA
        cov = np.cov(centered.T)
        if cov.shape == (2, 2):
            eigenvalues, eigenvectors = np.linalg.eigh(cov)
            # Principal direction is the eigenvector with largest eigenvalue
            principal = eigenvectors[:, -1]  # [row_dir, col_dir]
            component_angle = np.degrees(np.arctan2(principal[1], principal[0])) % 180
        else:
            component_angle = 0

        # Angle difference between component and roof long axis
        angle_diff = abs(component_angle - long_axis_angle)
        if angle_diff > 90:
            angle_diff = 180 - angle_diff

        # Linearity: eigenvalue ratio (high = linear/straight, low = blobby)
        if cov.shape == (2, 2) and eigenvalues[0] > 0:
            linearity = eigenvalues[1] / eigenvalues[0]
        else:
            linearity = 1.0

        # Component centroid relative to contour center
        cx, cy = centroids[label_id]
        dist_to_center = np.sqrt((cx - center[0])**2 + (cy - center[1])**2)
        max_dim = max(rect_w, rect_h) / 2

        # Classification logic based on roof type
        if roof_type == "flat":
            # Flat roofs shouldn't have interior edges, but if they do → ridge
            classified[component_mask > 0] = CLASS_RIDGE

        elif roof_type == "gable":
            # Gable: all interior edges are ridges (parallel to long axis)
            classified[component_mask > 0] = CLASS_RIDGE

        elif roof_type == "hip":
            # Hip roof has ridge (center, parallel) + hips (diagonal from ends)
            if angle_diff < 25 and dist_to_center < max_dim * 0.5:
                # Near-parallel to long axis + near center → ridge
                classified[component_mask > 0] = CLASS_RIDGE
            elif angle_diff > 25:
                # Diagonal → hip
                classified[component_mask > 0] = CLASS_HIP
            else:
                classified[component_mask > 0] = CLASS_RIDGE

        elif roof_type == "cross":
            # Cross-gable: ridges + valleys at intersections
            if angle_diff < 25:
                # Parallel to an axis → ridge
                classified[component_mask > 0] = CLASS_RIDGE
            elif linearity < 3.0 and dist_to_center < max_dim * 0.4:
                # Short, blobby, near center → valley (intersection point)
                classified[component_mask > 0] = CLASS_VALLEY
            elif angle_diff > 25 and angle_diff < 65:
                # Diagonal → hip
                classified[component_mask > 0] = CLASS_HIP
            else:
                # Default for cross → could be a second ridge or valley
                classified[component_mask > 0] = CLASS_VALLEY

        else:
            # Default: classify by angle
            if angle_diff < 25:
                classified[component_mask > 0] = CLASS_RIDGE
            elif angle_diff > 60:
                classified[component_mask > 0] = CLASS_VALLEY
            else:
                classified[component_mask > 0] = CLASS_HIP

    return classified


def create_annotation_mask(
    image_bgr: np.ndarray,
    roof_contours: list,
    interior_edges: np.ndarray,
    roof_type_override: str = None,
) -> np.ndarray:
    """Combine all detections into a single annotation mask.

    Uses roof type classification to assign interior edges as ridge/hip/valley
    instead of labeling everything as ridge.

    Priority (higher class overwrites lower):
      1. Background (class 0) — default
      2. Roof surface (class 1) — filled contours
      3. Interior edges (class 2-4) — classified per roof type
      4. Eave/rake (class 5) — contour outlines
    """
    h, w = image_bgr.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    # Fill roof surfaces
    cv2.drawContours(mask, roof_contours, -1, CLASS_ROOF, thickness=cv2.FILLED)

    # Classify interior edges per roof contour
    for cnt in roof_contours:
        # Create a mask for this specific contour
        cnt_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(cnt_mask, [cnt], -1, 1, thickness=cv2.FILLED)

        # Get interior edges within this contour
        cnt_edges = cv2.bitwise_and(interior_edges, interior_edges, mask=cnt_mask)
        if cnt_edges.sum() == 0:
            continue

        # Classify roof type from contour geometry (or use override)
        roof_type = roof_type_override if roof_type_override else classify_roof_type(cnt)

        # Classify each edge component
        classified = classify_edge_components(cnt_edges, cnt, roof_type)

        # Dilate to 3px width and apply to mask
        for cls_id in [CLASS_RIDGE, CLASS_HIP, CLASS_VALLEY]:
            cls_pixels = (classified == cls_id).astype(np.uint8)
            if cls_pixels.sum() > 0:
                cls_dilated = cv2.dilate(cls_pixels, np.ones((EDGE_WIDTH, EDGE_WIDTH), np.uint8))
                mask[cls_dilated > 0] = cls_id

    # Draw contour outlines as eave/rake edges (on top of everything)
    cv2.drawContours(mask, roof_contours, -1, CLASS_EAVE, thickness=EDGE_WIDTH)

    return mask


def process_image(image_path: Path, output_dir: Path, force: bool = False,
                  visualize: bool = False, roof_type_override: str = None) -> bool:
    """Process a single image → annotation mask."""
    slug = image_path.stem
    out_img = output_dir / f"{slug}.png"
    out_mask = output_dir / f"{slug}_mask.png"

    if out_mask.exists() and not force:
        print(f"  SKIP (exists): {out_mask.name}")
        return True

    # Load image
    image_bgr = cv2.imread(str(image_path))
    if image_bgr is None:
        print(f"  ERROR: could not load {image_path}")
        return False

    # Resize if needed
    if image_bgr.shape[:2] != (IMAGE_SIZE, IMAGE_SIZE):
        image_bgr = cv2.resize(image_bgr, (IMAGE_SIZE, IMAGE_SIZE))

    # Step 1: Detect roof regions
    roof_mask, sure_fg = detect_roof_regions(image_bgr)

    # Step 2: Extract individual roof contours
    contours = extract_roof_contours(roof_mask, min_area=600)
    print(f"  Found {len(contours)} roof regions")

    if len(contours) == 0:
        # Fall back to sure foreground
        contours = extract_roof_contours(sure_fg, min_area=400)
        print(f"  Fallback: {len(contours)} regions from distance transform")

    # Step 3: Detect interior edges
    # Create filled contour mask for interior edge detection
    contour_fill = np.zeros_like(roof_mask)
    cv2.drawContours(contour_fill, contours, -1, 1, thickness=cv2.FILLED)
    interior_edges = detect_interior_edges(image_bgr, contour_fill)

    # Step 4: Create annotation mask (with optional roof type override)
    mask = create_annotation_mask(image_bgr, contours, interior_edges, roof_type_override)

    # Roof type classification summary
    roof_types = {}
    for cnt in contours:
        rt = classify_roof_type(cnt)
        roof_types[rt] = roof_types.get(rt, 0) + 1
    type_str = ", ".join(f"{k}={v}" for k, v in sorted(roof_types.items()))
    print(f"  Roof types: {type_str}")

    # Stats
    total_pixels = IMAGE_SIZE * IMAGE_SIZE
    roof_pct = np.sum(mask == CLASS_ROOF) / total_pixels * 100
    ridge_pct = np.sum(mask == CLASS_RIDGE) / total_pixels * 100
    hip_pct = np.sum(mask == CLASS_HIP) / total_pixels * 100
    valley_pct = np.sum(mask == CLASS_VALLEY) / total_pixels * 100
    eave_pct = np.sum(mask == CLASS_EAVE) / total_pixels * 100

    if roof_pct < 1.0:
        print(f"  WARNING: low roof coverage ({roof_pct:.1f}%) — may need manual review")

    print(f"  Roof: {roof_pct:.1f}%, Ridge: {ridge_pct:.1f}%, Hip: {hip_pct:.1f}%, "
          f"Valley: {valley_pct:.1f}%, Eave: {eave_pct:.1f}%")

    # Save
    shutil.copy2(image_path, out_img)
    mask_img = Image.fromarray(mask, mode="L")
    mask_img.save(str(out_mask))
    print(f"  SAVED: {out_mask.name}")

    # Optional visualization
    if visualize:
        viz = create_visualization(image_bgr, mask)
        viz_path = output_dir / f"{slug}_viz.png"
        cv2.imwrite(str(viz_path), viz)
        print(f"  VIZ: {viz_path.name}")

    return True


def create_visualization(image_bgr: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Create a side-by-side visualization: original | colored mask overlay."""
    # Color map for classes
    colors = {
        CLASS_BG: (0, 0, 0),
        CLASS_ROOF: (128, 128, 128),
        CLASS_RIDGE: (0, 0, 255),    # Red in BGR
        CLASS_HIP: (0, 165, 255),    # Orange
        CLASS_VALLEY: (255, 0, 0),   # Blue
        CLASS_EAVE: (0, 255, 0),     # Green
        CLASS_FLASHING: (192, 192, 192),
    }

    # Create colored mask
    colored = np.zeros_like(image_bgr)
    for cls_id, color in colors.items():
        colored[mask == cls_id] = color

    # Overlay on original (50% blend for non-background)
    overlay = image_bgr.copy()
    non_bg = mask > 0
    overlay[non_bg] = cv2.addWeighted(image_bgr, 0.5, colored, 0.5, 0)[non_bg]

    # Side by side
    viz = np.hstack([image_bgr, overlay])
    return viz


def main():
    parser = argparse.ArgumentParser(
        description="Auto-annotate satellite images using computer vision"
    )
    parser.add_argument("--raw-dir", default=None, help="Raw images directory")
    parser.add_argument("--output", default=None, help="Output directory")
    parser.add_argument("--force", action="store_true", help="Overwrite existing")
    parser.add_argument("--visualize", action="store_true", help="Save visualization images")
    parser.add_argument("--slugs", nargs="*", help="Only process these slugs")
    parser.add_argument("--roof-type", choices=["gable", "hip", "cross", "flat", "complex"],
                        default=None, help="Override roof type for all contours (use when auto-classifier has low confidence)")
    args = parser.parse_args()

    ml_dir = Path(__file__).resolve().parent.parent
    raw_dir = Path(args.raw_dir) if args.raw_dir else ml_dir / "data" / "raw"
    output_dir = Path(args.output) if args.output else ml_dir / "data" / "annotated"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find images
    if args.slugs:
        image_files = [raw_dir / f"{s}.png" for s in args.slugs]
    else:
        image_files = sorted([
            f for f in raw_dir.glob("*.png")
            if f.stem != ".gitkeep"
        ])

    print(f"CV Auto-annotating {len(image_files)} images")
    print(f"  Raw dir:    {raw_dir}")
    print(f"  Output dir: {output_dir}")
    print()

    success = 0
    errors = 0

    for i, img_path in enumerate(image_files, 1):
        print(f"[{i}/{len(image_files)}] {img_path.stem}")
        try:
            ok = process_image(img_path, output_dir, args.force, args.visualize, args.roof_type)
            if ok:
                success += 1
            else:
                errors += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback
            traceback.print_exc()
            errors += 1

    print(f"\nDone. {success} succeeded, {errors} failed.")
    print(f"Annotations saved to {output_dir}")
    print()
    print("NEXT STEPS:")
    print("  1. Review annotations — ridge/hip/valley classification needs manual correction")
    print("  2. Use SkyHawk AnnotationTool or CVAT to refine edge types")
    print("  3. Run: python ml/scripts/train.py")


if __name__ == "__main__":
    main()
