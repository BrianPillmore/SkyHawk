import type { LatLng, RoofVertex, RoofFacet, RoofEdge, WasteCalculation } from '../types';

const EARTH_RADIUS_FT = 20902231; // Earth radius in feet

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the Haversine distance between two lat/lng points in feet
 */
export function haversineDistanceFt(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_FT * c;
}

/**
 * Calculate the flat (projected) area of a polygon defined by lat/lng vertices
 * using the Shoelace formula adapted for geographic coordinates.
 * Returns area in square feet.
 */
export function calculatePolygonAreaSqFt(vertices: LatLng[]): number {
  if (vertices.length < 3) return 0;

  // Convert to local x,y coordinates in feet relative to centroid
  const centroid = getCentroid(vertices);
  const points = vertices.map((v) => latLngToLocalFt(v, centroid));

  // Shoelace formula
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area) / 2;
}

/**
 * Adjust flat area for roof pitch to get true area.
 * Pitch is in x/12 format (e.g., 6 means 6/12 pitch).
 */
export function adjustAreaForPitch(flatAreaSqFt: number, pitch: number): number {
  if (pitch <= 0) return flatAreaSqFt;
  // pitch factor = sqrt(1 + (pitch/12)^2)
  const pitchFactor = Math.sqrt(1 + Math.pow(pitch / 12, 2));
  return flatAreaSqFt * pitchFactor;
}

/**
 * Get the pitch multiplier for a given pitch value
 */
export function getPitchMultiplier(pitch: number): number {
  return Math.sqrt(1 + Math.pow(pitch / 12, 2));
}

/**
 * Convert pitch (x/12) to degrees
 */
export function pitchToDegrees(pitch: number): number {
  return Math.atan(pitch / 12) * (180 / Math.PI);
}

/**
 * Convert degrees to pitch (x/12)
 */
export function degreesToPitch(degrees: number): number {
  return Math.tan(toRadians(degrees)) * 12;
}

/**
 * Convert lat/lng to local x,y in feet relative to a reference point
 */
export function latLngToLocalFt(point: LatLng, reference: LatLng): { x: number; y: number } {
  const latMid = toRadians((point.lat + reference.lat) / 2);
  const ftPerDegLat = EARTH_RADIUS_FT * (Math.PI / 180);
  const ftPerDegLng = ftPerDegLat * Math.cos(latMid);

  return {
    x: (point.lng - reference.lng) * ftPerDegLng,
    y: (point.lat - reference.lat) * ftPerDegLat,
  };
}

/**
 * Get centroid of a set of lat/lng points
 */
export function getCentroid(points: LatLng[]): LatLng {
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/**
 * Calculate edge length in feet between two vertices
 */
export function calculateEdgeLengthFt(a: LatLng, b: LatLng): number {
  return haversineDistanceFt(a, b);
}

/**
 * Calculate total length of edges by type
 */
export function calculateTotalEdgeLength(
  edges: RoofEdge[],
  _vertices: RoofVertex[],
  type?: string
): number {
  const filtered = type ? edges.filter((e) => e.type === type) : edges;
  return filtered.reduce((sum, edge) => sum + edge.lengthFt, 0);
}

/**
 * Calculate facet measurements from its vertices
 */
export function calculateFacetMeasurements(
  vertexIds: string[],
  allVertices: RoofVertex[],
  pitch: number
): { areaSqFt: number; trueAreaSqFt: number } {
  const vertices = vertexIds
    .map((id) => allVertices.find((v) => v.id === id))
    .filter((v): v is RoofVertex => v !== undefined);

  const areaSqFt = calculatePolygonAreaSqFt(vertices);
  const trueAreaSqFt = adjustAreaForPitch(areaSqFt, pitch);

  return { areaSqFt, trueAreaSqFt };
}

/**
 * Area in roofing squares (1 square = 100 sq ft)
 */
export function areaToSquares(areaSqFt: number): number {
  return areaSqFt / 100;
}

/**
 * Calculate waste factor based on roof complexity
 */
export function calculateSuggestedWaste(facets: RoofFacet[], edges: RoofEdge[]): number {
  const numFacets = facets.length;
  const numHipsValleys = edges.filter(
    (e) => e.type === 'hip' || e.type === 'valley'
  ).length;

  // Simple heuristic based on complexity
  if (numFacets <= 2 && numHipsValleys === 0) return 5;
  if (numFacets <= 4 && numHipsValleys <= 2) return 10;
  if (numFacets <= 8 && numHipsValleys <= 6) return 15;
  if (numFacets <= 12) return 20;
  return 25;
}

/**
 * Calculate waste table for different waste percentages
 */
export function calculateWasteTable(totalTrueAreaSqFt: number): WasteCalculation[] {
  return [5, 10, 12, 15, 17, 20, 25].map((wastePercent) => {
    const totalAreaWithWaste = totalTrueAreaSqFt * (1 + wastePercent / 100);
    return {
      wastePercent,
      totalAreaWithWaste,
      totalSquaresWithWaste: Math.ceil(areaToSquares(totalAreaWithWaste) * 10) / 10,
    };
  });
}

/**
 * Get predominant pitch from facets (the pitch covering the most area)
 */
export function getPredominantPitch(facets: RoofFacet[]): number {
  if (facets.length === 0) return 0;

  const pitchAreas = new Map<number, number>();
  for (const facet of facets) {
    const current = pitchAreas.get(facet.pitch) || 0;
    pitchAreas.set(facet.pitch, current + facet.trueAreaSqFt);
  }

  let maxArea = 0;
  let predominantPitch = 0;
  for (const [pitch, area] of pitchAreas) {
    if (area > maxArea) {
      maxArea = area;
      predominantPitch = pitch;
    }
  }

  return predominantPitch;
}

/**
 * Format number with commas and decimal places
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format area in sq ft
 */
export function formatArea(sqFt: number): string {
  return `${formatNumber(sqFt, 0)} sq ft`;
}

/**
 * Format length in linear feet
 */
export function formatLength(ft: number): string {
  return `${formatNumber(ft, 1)} ft`;
}

/**
 * Format pitch
 */
export function formatPitch(pitch: number): string {
  if (pitch === 0) return 'Flat';
  return `${pitch}/12`;
}

/**
 * Calculate the midpoint between two LatLng points
 */
export function getMidpoint(a: LatLng, b: LatLng): LatLng {
  return {
    lat: (a.lat + b.lat) / 2,
    lng: (a.lng + b.lng) / 2,
  };
}

/**
 * Point-in-polygon test using ray casting
 */
export function isPointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
