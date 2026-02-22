import type { LatLng } from '../types';
import { toRadians, latLngToLocalFt } from './geometry';

const EARTH_RADIUS_FT = 20902231;

/**
 * Convert local x,y coordinates (in feet) back to lat/lng relative to a reference point.
 * Reverse of latLngToLocalFt().
 */
export function localFtToLatLng(x: number, y: number, reference: LatLng): LatLng {
  const ftPerDegLat = EARTH_RADIUS_FT * (Math.PI / 180);
  const latMid = toRadians(reference.lat);
  const ftPerDegLng = ftPerDegLat * Math.cos(latMid);

  return {
    lat: reference.lat + y / ftPerDegLat,
    lng: reference.lng + x / ftPerDegLng,
  };
}

/**
 * Calculate bearing (azimuth) between two lat/lng points in radians.
 * Returns value in [0, 2*PI).
 */
export function bearing(a: LatLng, b: LatLng): number {
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
}

/**
 * Find intersection points between a line (defined by point + bearing) and a polygon.
 * The line extends infinitely in both directions from the point.
 * Returns intersection points sorted by distance from the origin point.
 */
export function findLinePolygonIntersections(
  origin: LatLng,
  bearingRad: number,
  polygon: LatLng[]
): LatLng[] {
  const intersections: { point: LatLng; dist: number }[] = [];

  // Convert to local coordinates for intersection math
  const ref = origin;
  const originLocal = { x: 0, y: 0 };

  // Line direction in local coords
  const dx = Math.sin(bearingRad);
  const dy = Math.cos(bearingRad);

  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const p1 = latLngToLocalFt(polygon[i], ref);
    const p2 = latLngToLocalFt(polygon[j], ref);

    // Line-segment intersection
    const intersection = lineSegmentIntersection(
      originLocal.x, originLocal.y, dx, dy,
      p1.x, p1.y, p2.x, p2.y
    );

    if (intersection) {
      const point = localFtToLatLng(intersection.x, intersection.y, ref);
      const dist = Math.hypot(intersection.x, intersection.y);
      intersections.push({ point, dist });
    }
  }

  // Sort by distance and return points
  intersections.sort((a, b) => a.dist - b.dist);
  return intersections.map((i) => i.point);
}

/**
 * Find intersection of a ray (origin + direction) with a line segment.
 * Returns intersection point or null if no intersection.
 */
function lineSegmentIntersection(
  ox: number, oy: number, dx: number, dy: number,
  x1: number, y1: number, x2: number, y2: number
): { x: number; y: number } | null {
  const sx = x2 - x1;
  const sy = y2 - y1;

  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-10) return null; // parallel

  const t = ((x1 - ox) * sy - (y1 - oy) * sx) / denom;
  const u = ((x1 - ox) * dy - (y1 - oy) * dx) / denom;

  if (u >= 0 && u <= 1) {
    return {
      x: ox + t * dx,
      y: oy + t * dy,
    };
  }

  return null;
}
