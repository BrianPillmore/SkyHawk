/**
 * Solar panel layout utilities.
 * Computes panel rectangle positions from Google Solar API data
 * for rendering on the map and in PDF reports.
 */

import type { SolarBuildingInsights, SolarPanel } from '../types/solar';

export interface PanelRectangle {
  /** Corners of the panel rectangle (4 lat/lng pairs, counterclockwise) */
  corners: { lat: number; lng: number }[];
  /** Center position */
  center: { lat: number; lng: number };
  /** Which roof segment this panel belongs to */
  segmentIndex: number;
  /** Annual energy production (DC kWh) */
  yearlyEnergyDcKwh: number;
  /** Panel orientation */
  orientation: 'LANDSCAPE' | 'PORTRAIT';
}

/**
 * Meters offset to lat/lng delta.
 * 1 degree latitude ≈ 111,320 meters.
 * 1 degree longitude ≈ 111,320 * cos(latitude) meters.
 */
function metersToLatDelta(meters: number): number {
  return meters / 111320;
}

function metersToLngDelta(meters: number, latitude: number): number {
  return meters / (111320 * Math.cos((latitude * Math.PI) / 180));
}

/**
 * Build panel rectangle corners from center, dimensions, and orientation.
 * Assumes panels are axis-aligned (no rotation for roof tilt/azimuth).
 * In practice, the panels are close enough to north-aligned that this works.
 */
function buildPanelCorners(
  center: { latitude: number; longitude: number },
  widthMeters: number,
  heightMeters: number,
  orientation: 'LANDSCAPE' | 'PORTRAIT',
): { lat: number; lng: number }[] {
  const w = orientation === 'LANDSCAPE' ? heightMeters : widthMeters;
  const h = orientation === 'LANDSCAPE' ? widthMeters : heightMeters;

  const halfW = w / 2;
  const halfH = h / 2;

  const dLat = metersToLatDelta(halfH);
  const dLng = metersToLngDelta(halfW, center.latitude);

  return [
    { lat: center.latitude - dLat, lng: center.longitude - dLng },
    { lat: center.latitude - dLat, lng: center.longitude + dLng },
    { lat: center.latitude + dLat, lng: center.longitude + dLng },
    { lat: center.latitude + dLat, lng: center.longitude - dLng },
  ];
}

/**
 * Convert Google Solar API panel data into renderable rectangle coordinates.
 * Returns one PanelRectangle per panel in the solarPanels[] array.
 */
export function computePanelLayout(
  insights: SolarBuildingInsights,
): PanelRectangle[] {
  const sp = insights.solarPotential;
  const panels: SolarPanel[] = sp.solarPanels ?? [];
  const widthMeters = sp.panelWidthMeters ?? 0.99;
  const heightMeters = sp.panelHeightMeters ?? 1.65;

  return panels.map((panel) => ({
    corners: buildPanelCorners(panel.center, widthMeters, heightMeters, panel.orientation),
    center: { lat: panel.center.latitude, lng: panel.center.longitude },
    segmentIndex: panel.segmentIndex,
    yearlyEnergyDcKwh: panel.yearlyEnergyDcKwh,
    orientation: panel.orientation,
  }));
}

/**
 * Get a color for a panel based on its relative energy output.
 * Higher energy → brighter blue, lower → dimmer.
 */
export function getPanelColor(yearlyEnergyDcKwh: number, maxEnergy: number): string {
  if (maxEnergy <= 0) return '#3B82F6'; // blue-500 default
  const ratio = Math.min(1, yearlyEnergyDcKwh / maxEnergy);
  if (ratio >= 0.85) return '#22D3EE'; // cyan-400
  if (ratio >= 0.70) return '#3B82F6'; // blue-500
  if (ratio >= 0.55) return '#6366F1'; // indigo-500
  return '#8B5CF6'; // violet-500
}

/**
 * Render panel layout onto an HTML canvas for PDF export.
 * Returns the canvas as a base64 data URL.
 */
export function renderPanelLayoutDiagram(
  panels: PanelRectangle[],
  canvasWidth: number = 800,
  canvasHeight: number = 600,
): string {
  if (panels.length === 0) return '';

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#111827'; // gray-900
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Find bounding box of all panels
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const panel of panels) {
    for (const c of panel.corners) {
      minLat = Math.min(minLat, c.lat);
      maxLat = Math.max(maxLat, c.lat);
      minLng = Math.min(minLng, c.lng);
      maxLng = Math.max(maxLng, c.lng);
    }
  }

  // Pad bounding box by 10%
  const latRange = maxLat - minLat || 0.0001;
  const lngRange = maxLng - minLng || 0.0001;
  minLat -= latRange * 0.1;
  maxLat += latRange * 0.1;
  minLng -= lngRange * 0.1;
  maxLng += lngRange * 0.1;

  const padLatRange = maxLat - minLat;
  const padLngRange = maxLng - minLng;

  // Margins
  const margin = 40;
  const drawW = canvasWidth - margin * 2;
  const drawH = canvasHeight - margin * 2;

  // Scale preserving aspect ratio
  const scaleX = drawW / padLngRange;
  const scaleY = drawH / padLatRange;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = margin + (drawW - padLngRange * scale) / 2;
  const offsetY = margin + (drawH - padLatRange * scale) / 2;

  function toCanvasX(lng: number): number {
    return offsetX + (lng - minLng) * scale;
  }
  function toCanvasY(lat: number): number {
    return offsetY + (maxLat - lat) * scale; // flip Y
  }

  // Max energy for color scaling
  const maxEnergy = Math.max(...panels.map(p => p.yearlyEnergyDcKwh), 1);

  // Draw panels
  for (const panel of panels) {
    const color = getPanelColor(panel.yearlyEnergyDcKwh, maxEnergy);
    ctx.fillStyle = color + '80'; // 50% alpha
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    ctx.beginPath();
    const c = panel.corners;
    ctx.moveTo(toCanvasX(c[0].lng), toCanvasY(c[0].lat));
    for (let i = 1; i < c.length; i++) {
      ctx.lineTo(toCanvasX(c[i].lng), toCanvasY(c[i].lat));
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Title
  ctx.fillStyle = '#9CA3AF';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Solar Panel Layout — ${panels.length} Panels`, canvasWidth / 2, 20);

  // Legend
  const legendY = canvasHeight - 15;
  const legendColors = [
    { color: '#22D3EE', label: 'High output' },
    { color: '#3B82F6', label: 'Good' },
    { color: '#6366F1', label: 'Moderate' },
    { color: '#8B5CF6', label: 'Lower' },
  ];
  let legendX = canvasWidth / 2 - 180;
  ctx.font = '11px sans-serif';
  for (const lc of legendColors) {
    ctx.fillStyle = lc.color;
    ctx.fillRect(legendX, legendY - 8, 12, 12);
    ctx.fillStyle = '#9CA3AF';
    ctx.textAlign = 'left';
    ctx.fillText(lc.label, legendX + 16, legendY + 2);
    legendX += 90;
  }

  return canvas.toDataURL('image/png');
}
