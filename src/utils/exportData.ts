import type { RoofMeasurement } from '../types';
import { estimateMaterials } from './materials';
import { calculateWasteTable } from './geometry';
import { EDGE_LABELS } from './colors';

// ─── Helpers ───────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── JSON Export ───────────────────────────────────────────────────

/**
 * Build the structured export data object from a measurement.
 */
export function buildExportData(measurement: RoofMeasurement) {
  const materials = measurement.totalSquares > 0 ? estimateMaterials(measurement) : null;
  const wasteTable = measurement.totalTrueAreaSqFt > 0
    ? calculateWasteTable(measurement.totalTrueAreaSqFt, measurement.suggestedWastePercent)
    : [];

  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    measurement: {
      id: measurement.id,
      propertyId: measurement.propertyId,
      createdAt: measurement.createdAt,
      updatedAt: measurement.updatedAt,
      summary: {
        totalAreaSqFt: measurement.totalAreaSqFt,
        totalTrueAreaSqFt: measurement.totalTrueAreaSqFt,
        totalSquares: measurement.totalSquares,
        predominantPitch: measurement.predominantPitch,
        suggestedWastePercent: measurement.suggestedWastePercent,
      },
      lineMeasurements: {
        totalRidgeLf: measurement.totalRidgeLf,
        totalHipLf: measurement.totalHipLf,
        totalValleyLf: measurement.totalValleyLf,
        totalRakeLf: measurement.totalRakeLf,
        totalEaveLf: measurement.totalEaveLf,
        totalFlashingLf: measurement.totalFlashingLf,
        totalDripEdgeLf: measurement.totalDripEdgeLf,
      },
      vertices: measurement.vertices,
      edges: measurement.edges.map((e) => ({
        id: e.id,
        type: e.type,
        startVertexId: e.startVertexId,
        endVertexId: e.endVertexId,
        lengthFt: e.lengthFt,
      })),
      facets: measurement.facets.map((f) => ({
        id: f.id,
        name: f.name,
        pitch: f.pitch,
        areaSqFt: f.areaSqFt,
        trueAreaSqFt: f.trueAreaSqFt,
        vertexIds: f.vertexIds,
      })),
      materialEstimates: materials,
      wasteTable,
    },
  };
}

/**
 * Export measurement data as a downloadable JSON file.
 */
export function exportMeasurementJSON(measurement: RoofMeasurement): void {
  const exportData = buildExportData(measurement);
  const json = JSON.stringify(exportData, null, 2);
  triggerDownload(
    new Blob([json], { type: 'application/json' }),
    `gotruf-measurement-${dateStamp()}.json`
  );
}

// ─── GeoJSON Export ────────────────────────────────────────────────

interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon';
    coordinates: number[] | number[][] | number[][][];
  };
}

interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Build a GeoJSON FeatureCollection from a measurement.
 * Edges become LineString features, facets become Polygon features.
 */
export function buildGeoJSON(measurement: RoofMeasurement): GeoJSONCollection {
  const features: GeoJSONFeature[] = [];

  // Edge LineStrings
  for (const edge of measurement.edges) {
    const startV = measurement.vertices.find((v) => v.id === edge.startVertexId);
    const endV = measurement.vertices.find((v) => v.id === edge.endVertexId);
    if (!startV || !endV) continue;

    features.push({
      type: 'Feature',
      properties: {
        featureType: 'edge',
        edgeType: edge.type,
        label: EDGE_LABELS[edge.type] || edge.type,
        lengthFt: +edge.lengthFt.toFixed(1),
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [startV.lng, startV.lat],
          [endV.lng, endV.lat],
        ],
      },
    });
  }

  // Facet Polygons
  for (const facet of measurement.facets) {
    const coords = facet.vertexIds
      .map((id) => measurement.vertices.find((v) => v.id === id))
      .filter((v) => v !== undefined)
      .map((v) => [v!.lng, v!.lat]);

    if (coords.length < 3) continue;
    // GeoJSON polygons must be closed rings
    coords.push(coords[0]);

    features.push({
      type: 'Feature',
      properties: {
        featureType: 'facet',
        name: facet.name,
        pitch: facet.pitch,
        areaSqFt: +facet.areaSqFt.toFixed(1),
        trueAreaSqFt: +facet.trueAreaSqFt.toFixed(1),
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
    });
  }

  // Vertex Points
  for (const v of measurement.vertices) {
    features.push({
      type: 'Feature',
      properties: { featureType: 'vertex' },
      geometry: {
        type: 'Point',
        coordinates: [v.lng, v.lat],
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Export measurement as downloadable GeoJSON file.
 */
export function exportMeasurementGeoJSON(measurement: RoofMeasurement): void {
  const geojson = buildGeoJSON(measurement);
  const json = JSON.stringify(geojson, null, 2);
  triggerDownload(
    new Blob([json], { type: 'application/geo+json' }),
    `gotruf-measurement-${dateStamp()}.geojson`
  );
}

// ─── CSV Export ────────────────────────────────────────────────────

/**
 * Build CSV content from a measurement (multi-section spreadsheet).
 */
export function buildCSV(measurement: RoofMeasurement): string {
  const lines: string[] = [];

  // Summary section
  lines.push('ROOF MEASUREMENT SUMMARY');
  lines.push('Metric,Value');
  lines.push(`Total True Area (sq ft),${measurement.totalTrueAreaSqFt.toFixed(1)}`);
  lines.push(`Total Flat Area (sq ft),${measurement.totalAreaSqFt.toFixed(1)}`);
  lines.push(`Total Squares,${measurement.totalSquares.toFixed(1)}`);
  lines.push(`Predominant Pitch,${measurement.predominantPitch}/12`);
  lines.push(`Suggested Waste %,${measurement.suggestedWastePercent}%`);
  lines.push(`Number of Facets,${measurement.facets.length}`);
  lines.push(`Number of Edges,${measurement.edges.length}`);
  lines.push('');

  // Line measurements
  lines.push('LINE MEASUREMENTS');
  lines.push('Type,Total Length (ft),Count');
  lines.push(`Ridges,${measurement.totalRidgeLf.toFixed(1)},${measurement.edges.filter((e) => e.type === 'ridge').length}`);
  lines.push(`Hips,${measurement.totalHipLf.toFixed(1)},${measurement.edges.filter((e) => e.type === 'hip').length}`);
  lines.push(`Valleys,${measurement.totalValleyLf.toFixed(1)},${measurement.edges.filter((e) => e.type === 'valley').length}`);
  lines.push(`Rakes,${measurement.totalRakeLf.toFixed(1)},${measurement.edges.filter((e) => e.type === 'rake').length}`);
  lines.push(`Eaves,${measurement.totalEaveLf.toFixed(1)},${measurement.edges.filter((e) => e.type === 'eave').length}`);
  lines.push(`Flashing,${measurement.totalFlashingLf.toFixed(1)},${measurement.edges.filter((e) => e.type === 'flashing' || e.type === 'step-flashing').length}`);
  lines.push(`Drip Edge (Total),${measurement.totalDripEdgeLf.toFixed(1)},`);
  lines.push('');

  // Facet details
  lines.push('FACET DETAILS');
  lines.push('Name,Pitch,Flat Area (sq ft),True Area (sq ft)');
  for (const f of measurement.facets) {
    lines.push(`"${f.name}",${f.pitch}/12,${f.areaSqFt.toFixed(1)},${f.trueAreaSqFt.toFixed(1)}`);
  }
  lines.push('');

  // Edge details
  lines.push('EDGE DETAILS');
  lines.push('Type,Length (ft),Start Vertex,End Vertex');
  for (const e of measurement.edges) {
    lines.push(`${EDGE_LABELS[e.type] || e.type},${e.lengthFt.toFixed(1)},${e.startVertexId},${e.endVertexId}`);
  }
  lines.push('');

  // Material estimates
  if (measurement.totalSquares > 0) {
    const mat = estimateMaterials(measurement);
    lines.push('MATERIAL ESTIMATES');
    lines.push('Material,Quantity,Unit');
    lines.push(`Shingle Bundles,${mat.shingleBundles},bundles`);
    lines.push(`Underlayment,${mat.underlaymentRolls},rolls`);
    lines.push(`Ice & Water Shield,${mat.iceWaterRolls},rolls`);
    lines.push(`Starter Strip,${mat.starterStripLf},lf`);
    lines.push(`Ridge Cap,${mat.ridgeCapLf},lf`);
    lines.push(`Drip Edge,${mat.dripEdgeLf},lf`);
    lines.push(`Step Flashing,${mat.stepFlashingPcs},pcs`);
    lines.push(`Pipe Boots,${mat.pipeBoots},pcs`);
    lines.push(`Roofing Nails,${mat.nailsLbs},lbs`);
    lines.push(`Caulk,${mat.caulkTubes},tubes`);
    lines.push(`Ridge Vent,${mat.ridgeVentLf},lf`);
  }

  return lines.join('\n');
}

/**
 * Export measurement as downloadable CSV file.
 */
export function exportMeasurementCSV(measurement: RoofMeasurement): void {
  const csv = buildCSV(measurement);
  triggerDownload(
    new Blob([csv], { type: 'text/csv' }),
    `gotruf-measurement-${dateStamp()}.csv`
  );
}
