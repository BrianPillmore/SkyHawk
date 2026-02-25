import type { Property } from '../types';

export interface PropertyPin {
  id: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  state: string;
  zip: string;
  hasMeasurements: boolean;
  measurementCount: number;
  totalAreaSqFt: number;
  totalSquares: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapCenter {
  lat: number;
  lng: number;
}

/**
 * Convert properties to pin data for map display.
 */
export function propertiesToPins(properties: Property[]): PropertyPin[] {
  return properties.map((p) => {
    const latest = p.measurements[p.measurements.length - 1];
    return {
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip,
      hasMeasurements: p.measurements.length > 0,
      measurementCount: p.measurements.length,
      totalAreaSqFt: latest?.totalTrueAreaSqFt || 0,
      totalSquares: latest?.totalSquares || 0,
    };
  });
}

/**
 * Calculate bounds that contain all pins, with padding.
 */
export function calculateBounds(pins: PropertyPin[]): MapBounds | null {
  if (pins.length === 0) return null;

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const pin of pins) {
    if (pin.lat > north) north = pin.lat;
    if (pin.lat < south) south = pin.lat;
    if (pin.lng > east) east = pin.lng;
    if (pin.lng < west) west = pin.lng;
  }

  // Add padding (roughly 10%)
  const latPad = Math.max((north - south) * 0.1, 0.005);
  const lngPad = Math.max((east - west) * 0.1, 0.005);

  return {
    north: north + latPad,
    south: south - latPad,
    east: east + lngPad,
    west: west - lngPad,
  };
}

/**
 * Calculate the center point of all pins.
 */
export function calculateCenter(pins: PropertyPin[]): MapCenter {
  if (pins.length === 0) return { lat: 35.4676, lng: -97.5164 }; // Default: OKC

  const sum = pins.reduce(
    (acc, pin) => ({ lat: acc.lat + pin.lat, lng: acc.lng + pin.lng }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: sum.lat / pins.length,
    lng: sum.lng / pins.length,
  };
}

/**
 * Calculate zoom level that fits bounds in a given map size.
 * Returns a zoom level 1-20.
 */
export function calculateZoomForBounds(bounds: MapBounds, mapWidth: number, mapHeight: number): number {
  const WORLD_DIM = { height: 256, width: 256 };
  const ZOOM_MAX = 18;

  function latRad(lat: number): number {
    const sin = Math.sin((lat * Math.PI) / 180);
    const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
  }

  function zoom(mapPx: number, worldPx: number, fraction: number): number {
    return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
  }

  const latFraction = (latRad(bounds.north) - latRad(bounds.south)) / Math.PI;
  const lngDiff = bounds.east - bounds.west;
  const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

  const latZoom = zoom(mapHeight, WORLD_DIM.height, latFraction);
  const lngZoom = zoom(mapWidth, WORLD_DIM.width, lngFraction);

  return Math.min(latZoom, lngZoom, ZOOM_MAX);
}

/**
 * Group nearby pins into clusters for display at lower zoom levels.
 * Uses a simple grid-based approach.
 */
export function clusterPins(
  pins: PropertyPin[],
  gridSize: number = 0.01, // ~1km grid cells
): { center: MapCenter; pins: PropertyPin[]; count: number }[] {
  if (pins.length === 0) return [];

  const grid = new Map<string, PropertyPin[]>();

  for (const pin of pins) {
    const cellLat = Math.floor(pin.lat / gridSize) * gridSize;
    const cellLng = Math.floor(pin.lng / gridSize) * gridSize;
    const key = `${cellLat.toFixed(6)},${cellLng.toFixed(6)}`;

    const existing = grid.get(key) || [];
    existing.push(pin);
    grid.set(key, existing);
  }

  return Array.from(grid.values()).map((clusterPins) => ({
    center: calculateCenter(clusterPins),
    pins: clusterPins,
    count: clusterPins.length,
  }));
}

/**
 * Get pin color based on measurement status.
 */
export function getPinColor(pin: PropertyPin): string {
  if (!pin.hasMeasurements) return '#6b7280'; // gray-500
  if (pin.totalAreaSqFt > 3000) return '#22c55e'; // green-500 (large)
  if (pin.totalAreaSqFt > 1500) return '#f59e0b'; // amber-500 (medium)
  return '#3b82f6'; // blue-500 (small)
}

/**
 * Format pin tooltip text.
 */
export function formatPinTooltip(pin: PropertyPin): string {
  const lines = [`${pin.address}`, `${pin.city}, ${pin.state} ${pin.zip}`];
  if (pin.hasMeasurements) {
    lines.push(`${pin.totalAreaSqFt.toLocaleString()} sq ft | ${pin.totalSquares.toFixed(1)} squares`);
    lines.push(`${pin.measurementCount} measurement${pin.measurementCount !== 1 ? 's' : ''}`);
  } else {
    lines.push('No measurements');
  }
  return lines.join('\n');
}
