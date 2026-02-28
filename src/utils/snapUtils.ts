/**
 * Pure-math helper for edge snapping — no Google Maps dependency.
 * Used by the pixel-space edge snap search in MapView.
 */

/**
 * Compute the closest point on segment AB to point P (in 2D).
 * Returns the parametric position `t` (clamped to [0, 1]) and squared distance.
 *
 * When used for edge snapping, callers should further clamp t to [0.02, 0.98]
 * to exclude near-endpoint hits (those should go to vertex snap instead).
 */
export function pointToSegmentDistSq(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): { t: number; distSq: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  // Zero-length segment — closest point is the endpoint itself
  if (lenSq === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return { t: 0, distSq: ex * ex + ey * ey };
  }

  // Parametric position of the projection of P onto line AB
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  // Closest point on segment
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;

  return { t, distSq: ex * ex + ey * ey };
}
