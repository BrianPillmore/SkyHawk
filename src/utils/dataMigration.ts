/**
 * One-time data migration utility: localStorage → server.
 *
 * Reads property data from the Zustand persisted state in localStorage,
 * pushes each property (and its measurements) to the server via propertyApi,
 * and sets a flag so the migration is never re-run.
 *
 * Idempotent: safe to call multiple times.
 */

import { createProperty, saveMeasurement } from '../services/propertyApi';
import type { Property, RoofMeasurement } from '../types';

const STORAGE_KEY = 'skyhawk-storage';
const MIGRATION_FLAG = 'skyhawk_data_migrated';

export interface MigrationResult {
  migrated: number;
  failed: number;
  errors: string[];
  alreadyMigrated: boolean;
}

/**
 * Read persisted properties out of localStorage.
 * Returns an empty array if nothing is found or the data is corrupt.
 */
export function readPersistedProperties(): Property[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const properties = parsed?.state?.properties;
    if (!Array.isArray(properties)) return [];
    return properties as Property[];
  } catch {
    return [];
  }
}

/**
 * Check whether localStorage contains property data that has not yet been
 * migrated to the server.
 */
export function needsMigration(): boolean {
  if (localStorage.getItem(MIGRATION_FLAG) === 'true') return false;
  const properties = readPersistedProperties();
  return properties.length > 0;
}

/**
 * Migrate a single property (and its measurements) to the server.
 * Returns `null` on success or an error string on failure.
 */
async function migrateOneProperty(
  property: Property,
  token: string,
): Promise<string | null> {
  try {
    const created = await createProperty({
      address: property.address,
      city: property.city,
      state: property.state,
      zip: property.zip,
      lat: property.lat,
      lng: property.lng,
      notes: property.notes,
    });

    // Push each measurement for this property
    for (const measurement of property.measurements ?? []) {
      await migrateMeasurement(created.id, measurement, token);
    }

    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Failed to migrate "${property.address}": ${message}`;
  }
}

/**
 * Push a single measurement to the server.
 */
async function migrateMeasurement(
  serverPropertyId: string,
  measurement: RoofMeasurement,
  _token: string,
): Promise<void> {
  await saveMeasurement(serverPropertyId, {
    vertices: measurement.vertices.map((v) => ({
      id: v.id,
      lat: v.lat,
      lng: v.lng,
    })),
    edges: measurement.edges.map((e) => ({
      id: e.id,
      startVertexId: e.startVertexId,
      endVertexId: e.endVertexId,
      type: e.type,
      lengthFt: e.lengthFt,
    })),
    facets: measurement.facets.map((f) => ({
      id: f.id,
      name: f.name,
      pitch: f.pitch,
      areaSqFt: f.areaSqFt,
      trueAreaSqFt: f.trueAreaSqFt,
      vertexIds: f.vertexIds,
      edgeIds: f.edgeIds,
    })),
    totalAreaSqFt: measurement.totalAreaSqFt,
    totalTrueAreaSqFt: measurement.totalTrueAreaSqFt,
    totalSquares: measurement.totalSquares,
    predominantPitch: measurement.predominantPitch,
    totalRidgeLf: measurement.totalRidgeLf,
    totalHipLf: measurement.totalHipLf,
    totalValleyLf: measurement.totalValleyLf,
    totalRakeLf: measurement.totalRakeLf,
    totalEaveLf: measurement.totalEaveLf,
    totalFlashingLf: measurement.totalFlashingLf,
    totalStepFlashingLf: measurement.totalStepFlashingLf,
    totalDripEdgeLf: measurement.totalDripEdgeLf,
    suggestedWastePercent: measurement.suggestedWastePercent,
    ridgeCount: measurement.ridgeCount,
    hipCount: measurement.hipCount,
    valleyCount: measurement.valleyCount,
    rakeCount: measurement.rakeCount,
    eaveCount: measurement.eaveCount,
    flashingCount: measurement.flashingCount,
    stepFlashingCount: measurement.stepFlashingCount,
    structureComplexity: measurement.structureComplexity,
    estimatedAtticSqFt: measurement.estimatedAtticSqFt,
    pitchBreakdown: measurement.pitchBreakdown,
    buildingHeightFt: measurement.buildingHeightFt,
    stories: measurement.stories,
    dataSource: measurement.dataSource,
  });
}

/**
 * Run the full migration.
 *
 * @param token - JWT auth token (passed through to API calls via localStorage
 *                state; included for explicitness / future use)
 * @returns MigrationResult summary
 */
export async function migrateLocalDataToServer(
  token: string,
): Promise<MigrationResult> {
  // Already migrated — short-circuit
  if (localStorage.getItem(MIGRATION_FLAG) === 'true') {
    return { migrated: 0, failed: 0, errors: [], alreadyMigrated: true };
  }

  const properties = readPersistedProperties();

  // Nothing to migrate
  if (properties.length === 0) {
    localStorage.setItem(MIGRATION_FLAG, 'true');
    return { migrated: 0, failed: 0, errors: [], alreadyMigrated: false };
  }

  let migrated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const property of properties) {
    const error = await migrateOneProperty(property, token);
    if (error === null) {
      migrated++;
    } else {
      failed++;
      errors.push(error);
    }
  }

  // Only set the flag if every property succeeded
  if (failed === 0) {
    localStorage.setItem(MIGRATION_FLAG, 'true');
  }

  return { migrated, failed, errors, alreadyMigrated: false };
}
