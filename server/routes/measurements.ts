import { Router, type Request, type Response } from 'express';
import { query, transaction } from '../db/index.js';
import { requireUuidParam } from '../middleware/validate.js';
import type { AuthPayload } from '../middleware/auth.js';
import type pg from 'pg';

const router = Router({ mergeParams: true });

type AuthRequest = Request & { user: AuthPayload };

/** Extract a single string param from Express params (Express 5 types return string | string[]) */
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

/** Verify user owns the property. Returns property row or null. */
async function verifyOwnership(
  propertyId: string,
  username: string,
  client?: pg.PoolClient,
): Promise<{ id: string } | null> {
  const q = client
    ? (text: string, params: unknown[]) => client.query(text, params)
    : (text: string, params: unknown[]) => query(text, params);

  const result = await q(
    `SELECT p.id FROM properties p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $1 AND u.username = $2`,
    [propertyId, username],
  );
  return result.rows[0] || null;
}

// ─── Interface for the full measurement graph payload ──────────────
interface VertexPayload {
  id: string;
  lat: number;
  lng: number;
}

interface EdgePayload {
  id: string;
  startVertexId: string;
  endVertexId: string;
  type: string;
  lengthFt: number;
}

interface FacetPayload {
  id: string;
  name: string;
  pitch: number;
  areaSqFt: number;
  trueAreaSqFt: number;
  vertexIds: string[];
  edgeIds: string[];
}

interface MeasurementPayload {
  vertices: VertexPayload[];
  edges: EdgePayload[];
  facets: FacetPayload[];
  totalAreaSqFt: number;
  totalTrueAreaSqFt: number;
  totalSquares: number;
  predominantPitch: number;
  totalRidgeLf: number;
  totalHipLf: number;
  totalValleyLf: number;
  totalRakeLf: number;
  totalEaveLf: number;
  totalFlashingLf: number;
  totalStepFlashingLf: number;
  totalDripEdgeLf: number;
  suggestedWastePercent: number;
  ridgeCount: number;
  hipCount: number;
  valleyCount: number;
  rakeCount: number;
  eaveCount: number;
  flashingCount: number;
  stepFlashingCount: number;
  structureComplexity: string;
  estimatedAtticSqFt: number;
  pitchBreakdown: unknown[];
  buildingHeightFt?: number;
  stories?: number;
  dataSource?: string;
}

// ─── LIST MEASUREMENTS ─────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const propertyId = param(req, 'propertyId');

    const ownership = await verifyOwnership(propertyId, username);
    if (!ownership) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const result = await query(
      `SELECT id, total_area_sqft, total_true_area_sqft, total_squares,
              predominant_pitch, suggested_waste_percent, structure_complexity,
              ridge_count, hip_count, valley_count, rake_count, eave_count,
              flashing_count, step_flashing_count, data_source,
              created_at, updated_at
       FROM roof_measurements
       WHERE property_id = $1
       ORDER BY created_at DESC`,
      [propertyId],
    );

    res.json({ measurements: result.rows });
  } catch (err) {
    console.error('List measurements error:', err);
    res.status(500).json({ error: 'Failed to list measurements' });
  }
});

// ─── GET MEASUREMENT (full graph) ──────────────────────────────────
router.get('/:mid', requireUuidParam('mid'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const propertyId = param(req, 'propertyId');
    const mid = param(req, 'mid');

    const ownership = await verifyOwnership(propertyId, username);
    if (!ownership) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    // Get measurement
    const mResult = await query(
      `SELECT * FROM roof_measurements WHERE id = $1 AND property_id = $2`,
      [mid, propertyId],
    );
    if (mResult.rows.length === 0) {
      res.status(404).json({ error: 'Measurement not found' });
      return;
    }
    const measurement = mResult.rows[0];

    // Get vertices (ordered)
    const vertices = await query(
      `SELECT id, lat, lng FROM roof_vertices
       WHERE measurement_id = $1 ORDER BY sort_order`,
      [mid],
    );

    // Get edges
    const edges = await query(
      `SELECT id, start_vertex_id, end_vertex_id, type, length_ft
       FROM roof_edges WHERE measurement_id = $1`,
      [mid],
    );

    // Get facets with their vertex/edge IDs
    const facets = await query(
      `SELECT id, name, pitch, area_sqft, true_area_sqft
       FROM roof_facets WHERE measurement_id = $1 ORDER BY sort_order`,
      [mid],
    );

    // Get facet-vertex mappings
    const facetVertices = await query(
      `SELECT facet_id, vertex_id FROM facet_vertices
       WHERE facet_id = ANY($1::uuid[]) ORDER BY sort_order`,
      [facets.rows.map((f) => f.id)],
    );

    // Get facet-edge mappings
    const facetEdges = await query(
      `SELECT facet_id, edge_id FROM facet_edges
       WHERE facet_id = ANY($1::uuid[])`,
      [facets.rows.map((f) => f.id)],
    );

    // Assemble facets with vertexIds and edgeIds
    const facetVertexMap = new Map<string, string[]>();
    const facetEdgeMap = new Map<string, string[]>();
    for (const fv of facetVertices.rows) {
      const arr = facetVertexMap.get(fv.facet_id) || [];
      arr.push(fv.vertex_id);
      facetVertexMap.set(fv.facet_id, arr);
    }
    for (const fe of facetEdges.rows) {
      const arr = facetEdgeMap.get(fe.facet_id) || [];
      arr.push(fe.edge_id);
      facetEdgeMap.set(fe.facet_id, arr);
    }

    const assembledFacets = facets.rows.map((f) => ({
      id: f.id,
      name: f.name,
      pitch: f.pitch,
      areaSqFt: f.area_sqft,
      trueAreaSqFt: f.true_area_sqft,
      vertexIds: facetVertexMap.get(f.id) || [],
      edgeIds: facetEdgeMap.get(f.id) || [],
    }));

    // Convert snake_case DB columns to camelCase for client
    res.json({
      id: measurement.id,
      propertyId: measurement.property_id,
      createdAt: measurement.created_at,
      updatedAt: measurement.updated_at,
      totalAreaSqFt: measurement.total_area_sqft,
      totalTrueAreaSqFt: measurement.total_true_area_sqft,
      totalSquares: measurement.total_squares,
      predominantPitch: measurement.predominant_pitch,
      totalRidgeLf: measurement.total_ridge_lf,
      totalHipLf: measurement.total_hip_lf,
      totalValleyLf: measurement.total_valley_lf,
      totalRakeLf: measurement.total_rake_lf,
      totalEaveLf: measurement.total_eave_lf,
      totalFlashingLf: measurement.total_flashing_lf,
      totalStepFlashingLf: measurement.total_step_flashing_lf,
      totalDripEdgeLf: measurement.total_drip_edge_lf,
      suggestedWastePercent: measurement.suggested_waste_percent,
      ridgeCount: measurement.ridge_count,
      hipCount: measurement.hip_count,
      valleyCount: measurement.valley_count,
      rakeCount: measurement.rake_count,
      eaveCount: measurement.eave_count,
      flashingCount: measurement.flashing_count,
      stepFlashingCount: measurement.step_flashing_count,
      structureComplexity: measurement.structure_complexity,
      estimatedAtticSqFt: measurement.estimated_attic_sqft,
      pitchBreakdown: measurement.pitch_breakdown,
      buildingHeightFt: measurement.building_height_ft,
      stories: measurement.stories,
      dataSource: measurement.data_source,
      vertices: vertices.rows.map((v) => ({
        id: v.id,
        lat: v.lat,
        lng: v.lng,
      })),
      edges: edges.rows.map((e) => ({
        id: e.id,
        startVertexId: e.start_vertex_id,
        endVertexId: e.end_vertex_id,
        type: e.type,
        lengthFt: e.length_ft,
      })),
      facets: assembledFacets,
    });
  } catch (err) {
    console.error('Get measurement error:', err);
    res.status(500).json({ error: 'Failed to get measurement' });
  }
});

// ─── SAVE MEASUREMENT (full graph in a transaction) ────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const propertyId = param(req, 'propertyId');
    const payload = req.body as MeasurementPayload;

    const result = await transaction(async (client) => {
      // Verify ownership
      const ownership = await verifyOwnership(propertyId, username, client);
      if (!ownership) return null;

      // 1. Insert measurement record
      const mResult = await client.query(
        `INSERT INTO roof_measurements (
           property_id, total_area_sqft, total_true_area_sqft, total_squares,
           predominant_pitch, total_ridge_lf, total_hip_lf, total_valley_lf,
           total_rake_lf, total_eave_lf, total_flashing_lf, total_step_flashing_lf,
           total_drip_edge_lf, suggested_waste_percent,
           ridge_count, hip_count, valley_count, rake_count, eave_count,
           flashing_count, step_flashing_count, structure_complexity,
           estimated_attic_sqft, pitch_breakdown,
           building_height_ft, stories, data_source
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
           $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
         ) RETURNING id, created_at`,
        [
          propertyId,
          payload.totalAreaSqFt ?? 0,
          payload.totalTrueAreaSqFt ?? 0,
          payload.totalSquares ?? 0,
          payload.predominantPitch ?? 0,
          payload.totalRidgeLf ?? 0,
          payload.totalHipLf ?? 0,
          payload.totalValleyLf ?? 0,
          payload.totalRakeLf ?? 0,
          payload.totalEaveLf ?? 0,
          payload.totalFlashingLf ?? 0,
          payload.totalStepFlashingLf ?? 0,
          payload.totalDripEdgeLf ?? 0,
          payload.suggestedWastePercent ?? 15,
          payload.ridgeCount ?? 0,
          payload.hipCount ?? 0,
          payload.valleyCount ?? 0,
          payload.rakeCount ?? 0,
          payload.eaveCount ?? 0,
          payload.flashingCount ?? 0,
          payload.stepFlashingCount ?? 0,
          payload.structureComplexity ?? 'Simple',
          payload.estimatedAtticSqFt ?? 0,
          JSON.stringify(payload.pitchBreakdown ?? []),
          payload.buildingHeightFt ?? null,
          payload.stories ?? null,
          payload.dataSource ?? null,
        ],
      );
      const measurementId = mResult.rows[0].id;

      // 2. Insert vertices — build a map from client ID → DB ID
      const vertexIdMap = new Map<string, string>();
      for (let i = 0; i < (payload.vertices || []).length; i++) {
        const v = payload.vertices[i];
        const vResult = await client.query(
          `INSERT INTO roof_vertices (measurement_id, lat, lng, sort_order)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [measurementId, v.lat, v.lng, i],
        );
        vertexIdMap.set(v.id, vResult.rows[0].id);
      }

      // 3. Insert edges — map client vertex IDs to DB vertex IDs
      const edgeIdMap = new Map<string, string>();
      for (const e of payload.edges || []) {
        const startId = vertexIdMap.get(e.startVertexId);
        const endId = vertexIdMap.get(e.endVertexId);
        if (!startId || !endId) continue; // skip orphan edges

        const eResult = await client.query(
          `INSERT INTO roof_edges (measurement_id, start_vertex_id, end_vertex_id, type, length_ft)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [measurementId, startId, endId, e.type, e.lengthFt ?? 0],
        );
        edgeIdMap.set(e.id, eResult.rows[0].id);
      }

      // 4. Insert facets with vertex/edge junctions
      for (let i = 0; i < (payload.facets || []).length; i++) {
        const f = payload.facets[i];
        const fResult = await client.query(
          `INSERT INTO roof_facets (measurement_id, name, pitch, area_sqft, true_area_sqft, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [measurementId, f.name || '', f.pitch ?? 0, f.areaSqFt ?? 0, f.trueAreaSqFt ?? 0, i],
        );
        const facetId = fResult.rows[0].id;

        // Facet-vertex junctions
        for (let vi = 0; vi < (f.vertexIds || []).length; vi++) {
          const dbVertexId = vertexIdMap.get(f.vertexIds[vi]);
          if (dbVertexId) {
            await client.query(
              `INSERT INTO facet_vertices (facet_id, vertex_id, sort_order)
               VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
              [facetId, dbVertexId, vi],
            );
          }
        }

        // Facet-edge junctions
        for (const edgeClientId of f.edgeIds || []) {
          const dbEdgeId = edgeIdMap.get(edgeClientId);
          if (dbEdgeId) {
            await client.query(
              `INSERT INTO facet_edges (facet_id, edge_id)
               VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [facetId, dbEdgeId],
            );
          }
        }
      }

      // 5. Update property timestamp
      await client.query(
        'UPDATE properties SET updated_at = NOW() WHERE id = $1',
        [propertyId],
      );

      return { measurementId, createdAt: mResult.rows[0].created_at };
    });

    if (!result) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    res.status(201).json({
      id: result.measurementId,
      createdAt: result.createdAt,
    });
  } catch (err) {
    console.error('Save measurement error:', err);
    res.status(500).json({ error: 'Failed to save measurement' });
  }
});

// ─── DELETE MEASUREMENT ────────────────────────────────────────────
router.delete('/:mid', requireUuidParam('mid'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const propertyId = param(req, 'propertyId');
    const mid = param(req, 'mid');

    const ownership = await verifyOwnership(propertyId, username);
    if (!ownership) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const result = await query(
      'DELETE FROM roof_measurements WHERE id = $1 AND property_id = $2 RETURNING id',
      [mid, propertyId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Measurement not found' });
      return;
    }

    res.json({ deleted: true, id: mid });
  } catch (err) {
    console.error('Delete measurement error:', err);
    res.status(500).json({ error: 'Failed to delete measurement' });
  }
});

export { router as measurementsRouter };
