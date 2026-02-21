import type { RoofMeasurement } from '../types';
import { estimateMaterials } from './materials';
import { calculateWasteTable } from './geometry';

/**
 * Build the structured export data object from a measurement.
 */
export function buildExportData(measurement: RoofMeasurement) {
  const materials = measurement.totalSquares > 0 ? estimateMaterials(measurement) : null;
  const wasteTable = measurement.totalTrueAreaSqFt > 0
    ? calculateWasteTable(measurement.totalTrueAreaSqFt)
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
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `skyhawk-measurement-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
