/**
 * Programmatic wireframe diagram renderer for PDF reports.
 * Renders Length, Area, and Pitch diagrams as offscreen canvas images.
 * These match EagleView Premium's labeled wireframe diagram pages.
 */

import type { RoofMeasurement, RoofVertex, RoofEdge, RoofFacet, EdgeType } from '../types';
import { latLngToLocalFt, getCentroid, formatPitch } from './geometry';
import { EDGE_COLORS } from './colors';

/** Canvas dimensions for rendered diagrams */
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDING = 60;

/** Pitch color scale: green (low pitch) to red (steep) */
const PITCH_COLORS: [number, number, string][] = [
  [0, 3, '#22c55e'],    // Green for flat/low
  [3, 6, '#84cc16'],    // Lime
  [6, 9, '#eab308'],    // Yellow
  [9, 12, '#f97316'],   // Orange
  [12, 24, '#ef4444'],  // Red for steep
];

function getPitchColor(pitch: number): string {
  for (const [min, max, color] of PITCH_COLORS) {
    if (pitch >= min && pitch < max) return color;
  }
  return '#ef4444'; // Default to red for very steep
}

interface ProjectedPoint {
  x: number;
  y: number;
}

/**
 * Project all vertices from lat/lng to pixel coordinates on the canvas.
 * Maintains aspect ratio and centers the roof in the canvas.
 */
function projectVertices(vertices: RoofVertex[]): Map<string, ProjectedPoint> {
  if (vertices.length === 0) return new Map();

  const centroid = getCentroid(vertices);
  const localPoints = vertices.map(v => ({
    id: v.id,
    ...latLngToLocalFt(v, centroid),
  }));

  // Find bounding box in feet
  const xs = localPoints.map(p => p.x);
  const ys = localPoints.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  // Available drawing area
  const drawWidth = CANVAS_WIDTH - 2 * PADDING;
  const drawHeight = CANVAS_HEIGHT - 2 * PADDING;

  // Scale to fit while preserving aspect ratio
  const scale = Math.min(drawWidth / rangeX, drawHeight / rangeY);

  // Center offset
  const offsetX = PADDING + (drawWidth - rangeX * scale) / 2;
  const offsetY = PADDING + (drawHeight - rangeY * scale) / 2;

  const projected = new Map<string, ProjectedPoint>();
  for (const p of localPoints) {
    projected.set(p.id, {
      x: offsetX + (p.x - minX) * scale,
      // Flip Y axis (lat increases upward, canvas Y increases downward)
      y: CANVAS_HEIGHT - (offsetY + (p.y - minY) * scale),
    });
  }

  return projected;
}

/**
 * Get the vertices of a facet as projected points.
 */
function getFacetProjectedVertices(
  facet: RoofFacet,
  projected: Map<string, ProjectedPoint>
): ProjectedPoint[] {
  return facet.vertexIds
    .map(id => projected.get(id))
    .filter((p): p is ProjectedPoint => p !== undefined);
}

/**
 * Draw a filled polygon path for a facet.
 */
function drawFacetPolygon(
  ctx: CanvasRenderingContext2D,
  points: ProjectedPoint[],
  fillColor: string,
  strokeColor: string = 'rgba(255, 255, 255, 0.6)',
  lineWidth: number = 1.5
): void {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * Calculate the centroid of projected points.
 */
function getProjectedCentroid(points: ProjectedPoint[]): ProjectedPoint {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * Draw a text label with background for readability.
 */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number = 11,
  textColor: string = '#ffffff',
  bgColor: string = 'rgba(0, 0, 0, 0.7)',
  bold: boolean = false
): void {
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px Arial, sans-serif`;
  const metrics = ctx.measureText(text);
  const pad = 3;
  const bgWidth = metrics.width + pad * 2;
  const bgHeight = fontSize + pad * 2;

  ctx.fillStyle = bgColor;
  ctx.fillRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight);

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/**
 * Draw the base wireframe (all edges in white/gray) as background context.
 */
function drawBaseWireframe(
  ctx: CanvasRenderingContext2D,
  edges: RoofEdge[],
  projected: Map<string, ProjectedPoint>
): void {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  for (const edge of edges) {
    const start = projected.get(edge.startVertexId);
    const end = projected.get(edge.endVertexId);
    if (!start || !end) continue;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
}

/**
 * Draw compass rose indicator in the top-right corner.
 */
function drawCompass(ctx: CanvasRenderingContext2D): void {
  const cx = CANVAS_WIDTH - 40;
  const cy = 40;
  const r = 18;

  // Circle background
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();

  // N arrow
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx - 5, cy);
  ctx.lineTo(cx + 5, cy);
  ctx.closePath();
  ctx.fillStyle = '#ef4444';
  ctx.fill();

  // S arrow
  ctx.beginPath();
  ctx.moveTo(cx, cy + r);
  ctx.lineTo(cx - 5, cy);
  ctx.lineTo(cx + 5, cy);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // N label
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', cx, cy - r - 8);
}

/**
 * Set up canvas with dark background.
 */
function setupCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Dark background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  return { canvas, ctx };
}

/**
 * Render a LENGTH DIAGRAM: edges colored by type with length labels at midpoints.
 * Matches EagleView Premium's "Length Diagram" page.
 */
export function renderLengthDiagram(measurement: RoofMeasurement): string | null {
  const setup = setupCanvas();
  if (!setup) return null;
  const { canvas, ctx } = setup;

  const projected = projectVertices(measurement.vertices);
  if (projected.size === 0) return null;

  // Draw facet fills for context
  for (const facet of measurement.facets) {
    const points = getFacetProjectedVertices(facet, projected);
    drawFacetPolygon(ctx, points, 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.15)');
  }

  // Draw edges colored by type with length labels
  for (const edge of measurement.edges) {
    const start = projected.get(edge.startVertexId);
    const end = projected.get(edge.endVertexId);
    if (!start || !end) continue;

    const color = EDGE_COLORS[edge.type] || '#ffffff';

    // Draw edge line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Label at midpoint with length
    if (edge.lengthFt > 0) {
      const mx = (start.x + end.x) / 2;
      const my = (start.y + end.y) / 2;
      drawLabel(ctx, `${edge.lengthFt.toFixed(1)}'`, mx, my, 10, '#ffffff', color + 'cc');
    }
  }

  // Draw vertex dots
  for (const [, point] of projected) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
  }

  drawCompass(ctx);

  // Legend
  drawEdgeLegend(ctx);

  return canvas.toDataURL('image/png');
}

/**
 * Draw edge type legend at the bottom.
 */
function drawEdgeLegend(ctx: CanvasRenderingContext2D): void {
  const types: [EdgeType, string][] = [
    ['ridge', 'Ridge'],
    ['hip', 'Hip'],
    ['valley', 'Valley'],
    ['rake', 'Rake'],
    ['eave', 'Eave'],
    ['flashing', 'Flashing'],
  ];
  const legendY = CANVAS_HEIGHT - 20;
  const startX = 20;
  const spacing = 110;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, legendY - 12, CANVAS_WIDTH, 30);

  for (let i = 0; i < types.length; i++) {
    const [type, label] = types[i];
    const x = startX + i * spacing;

    // Color swatch
    ctx.fillStyle = EDGE_COLORS[type];
    ctx.fillRect(x, legendY - 4, 16, 4);

    // Label
    ctx.font = '10px Arial, sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 20, legendY);
  }
}

/**
 * Render an AREA DIAGRAM: facets filled with colors and labeled with area.
 * Matches EagleView Premium's "Area Diagram" page.
 */
export function renderAreaDiagram(measurement: RoofMeasurement): string | null {
  const setup = setupCanvas();
  if (!setup) return null;
  const { canvas, ctx } = setup;

  const projected = projectVertices(measurement.vertices);
  if (projected.size === 0) return null;

  const facetColors = [
    'rgba(59, 130, 246, 0.35)',
    'rgba(16, 185, 129, 0.35)',
    'rgba(245, 158, 11, 0.35)',
    'rgba(139, 92, 246, 0.35)',
    'rgba(236, 72, 153, 0.35)',
    'rgba(249, 115, 22, 0.35)',
    'rgba(6, 182, 212, 0.35)',
    'rgba(132, 204, 22, 0.35)',
  ];

  // Draw facet fills with area labels
  for (let i = 0; i < measurement.facets.length; i++) {
    const facet = measurement.facets[i];
    const points = getFacetProjectedVertices(facet, projected);
    if (points.length < 3) continue;

    const color = facetColors[i % facetColors.length];
    drawFacetPolygon(ctx, points, color, '#fbbf24', 2);

    // Label at centroid
    const centroid = getProjectedCentroid(points);
    const areaText = `#${i + 1} — ${Math.round(facet.trueAreaSqFt).toLocaleString()} sf`;
    drawLabel(ctx, areaText, centroid.x, centroid.y, 11, '#ffffff', 'rgba(0, 0, 0, 0.75)', true);
  }

  // Draw edges as wireframe overlay
  drawBaseWireframe(ctx, measurement.edges, projected);

  drawCompass(ctx);

  // Area legend showing facet color swatches
  drawAreaLegend(ctx, measurement.facets.length, facetColors);

  return canvas.toDataURL('image/png');
}

/**
 * Draw area diagram legend showing facet color swatches at the bottom.
 */
function drawAreaLegend(ctx: CanvasRenderingContext2D, facetCount: number, colors: string[]): void {
  const legendY = CANVAS_HEIGHT - 20;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, legendY - 12, CANVAS_WIDTH, 30);

  const maxLegendItems = Math.min(facetCount, 8);
  const totalWidth = maxLegendItems * 80;
  const startX = (CANVAS_WIDTH - totalWidth) / 2;

  for (let i = 0; i < maxLegendItems; i++) {
    const x = startX + i * 80;
    // Color swatch
    ctx.fillStyle = colors[i % colors.length].replace('0.35', '0.7');
    ctx.fillRect(x, legendY - 6, 14, 8);
    // Label
    ctx.font = '10px Arial, sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`#${i + 1}`, x + 18, legendY);
  }
}

/**
 * Render a PITCH DIAGRAM: facets color-coded by pitch, labeled with pitch value.
 * Matches EagleView Premium's "Pitch Diagram" page.
 */
export function renderPitchDiagram(measurement: RoofMeasurement): string | null {
  const setup = setupCanvas();
  if (!setup) return null;
  const { canvas, ctx } = setup;

  const projected = projectVertices(measurement.vertices);
  if (projected.size === 0) return null;

  // Draw facets color-coded by pitch
  for (let i = 0; i < measurement.facets.length; i++) {
    const facet = measurement.facets[i];
    const points = getFacetProjectedVertices(facet, projected);
    if (points.length < 3) continue;

    const pitchColor = getPitchColor(facet.pitch);
    drawFacetPolygon(ctx, points, pitchColor + '66', pitchColor, 2);

    // Label at centroid with pitch
    const centroid = getProjectedCentroid(points);
    drawLabel(ctx, formatPitch(facet.pitch), centroid.x, centroid.y, 12, '#ffffff', pitchColor + 'dd', true);
  }

  // Wireframe overlay
  drawBaseWireframe(ctx, measurement.edges, projected);

  drawCompass(ctx);

  // Pitch legend
  drawPitchLegend(ctx);

  return canvas.toDataURL('image/png');
}

/**
 * Draw pitch color scale legend at the bottom.
 */
function drawPitchLegend(ctx: CanvasRenderingContext2D): void {
  const legendY = CANVAS_HEIGHT - 20;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, legendY - 12, CANVAS_WIDTH, 30);

  const labels = ['Flat-3/12', '3-6/12', '6-9/12', '9-12/12', '12+/12'];
  const startX = 60;
  const spacing = 140;

  for (let i = 0; i < PITCH_COLORS.length; i++) {
    const [, , color] = PITCH_COLORS[i];
    const x = startX + i * spacing;

    // Color swatch
    ctx.fillStyle = color;
    ctx.fillRect(x, legendY - 6, 20, 8);

    // Label
    ctx.font = '10px Arial, sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[i], x + 24, legendY);
  }
}
