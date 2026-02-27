import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

const router = Router();

// ── Image storage directory ──────────────────────────────────────────────────
// Images stored on filesystem, metadata in PostgreSQL.
// Path: ml/data/annotations/{uuid}.png, {uuid}_mask.png
const STORAGE_DIR = path.resolve(__dirname, '../../ml/data/annotations');

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// ── Database helpers ─────────────────────────────────────────────────────────

async function isDbAvailable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    const { query } = await import('../db/index.js');
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function getQuery() {
  const { query } = await import('../db/index.js');
  return query;
}

// ── Helper: save image to filesystem ─────────────────────────────────────────

function saveImage(id: string, imageBase64: string, suffix: string = ''): string {
  const filename = `${id}${suffix}.png`;
  const filePath = path.join(STORAGE_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(imageBase64, 'base64'));
  return filePath;
}

function getStoragePath(id: string, suffix: string = ''): string {
  return path.join(STORAGE_DIR, `${id}${suffix}.png`);
}

// ── GET /api/ml/annotations ──────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response) => {
  try {
    if (await isDbAvailable()) {
      const query = await getQuery();
      const result = await query(
        `SELECT id, address, source, status, roof_type, edge_count, vertex_count,
                edge_pixel_pct, created_at
         FROM ml_annotations
         ORDER BY created_at DESC
         LIMIT 200`
      );
      res.json(result.rows);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error('Failed to list annotations:', err);
    res.status(500).json({ error: 'Failed to list annotations' });
  }
});

// ── POST /api/ml/annotations ─────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, imageBase64, maskBase64, metadata: extraMeta } = req.body;

    if (!imageBase64 || !maskBase64) {
      res.status(400).json({ error: 'imageBase64 and maskBase64 are required' });
      return;
    }

    const id = randomUUID();

    // Save images to filesystem
    const imagePath = saveImage(id, imageBase64);
    const maskPath = saveImage(id, maskBase64, '_mask');

    // Save to database
    if (await isDbAvailable()) {
      const query = await getQuery();
      const userId = (req as any).user?.id || null;
      await query(
        `INSERT INTO ml_annotations (id, user_id, address, source, image_path, mask_path, notes)
         VALUES ($1, $2, $3, 'manual', $4, $5, $6)`,
        [id, userId, name || '', imagePath, maskPath, JSON.stringify(extraMeta || {})]
      );
    }

    res.json({ id, name, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error('Failed to save annotation:', err);
    res.status(500).json({ error: 'Failed to save annotation' });
  }
});

// ── GET /api/ml/annotations/:id ──────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (await isDbAvailable()) {
      const query = await getQuery();
      const result = await query(
        `SELECT a.*,
                array_agg(DISTINCT jsonb_build_object(
                  'index', v.vertex_index, 'lat', v.lat, 'lng', v.lng,
                  'px', v.pixel_x, 'py', v.pixel_y
                )) FILTER (WHERE v.id IS NOT NULL) AS vertices,
                array_agg(DISTINCT jsonb_build_object(
                  'startIdx', e.start_vertex_idx, 'endIdx', e.end_vertex_idx,
                  'type', e.edge_type, 'lengthFt', e.length_ft
                )) FILTER (WHERE e.id IS NOT NULL) AS edges
         FROM ml_annotations a
         LEFT JOIN ml_annotation_vertices v ON v.annotation_id = a.id
         LEFT JOIN ml_annotation_edges e ON e.annotation_id = a.id
         WHERE a.id = $1
         GROUP BY a.id`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Annotation not found' });
        return;
      }

      const row = result.rows[0];

      // Read images from filesystem
      let imageBase64 = null;
      let maskBase64 = null;
      if (row.image_path && fs.existsSync(row.image_path)) {
        imageBase64 = fs.readFileSync(row.image_path).toString('base64');
      }
      if (row.mask_path && fs.existsSync(row.mask_path)) {
        maskBase64 = fs.readFileSync(row.mask_path).toString('base64');
      }

      res.json({ ...row, imageBase64, maskBase64 });
    } else {
      res.status(404).json({ error: 'Annotation not found (no database)' });
    }
  } catch (err) {
    console.error('Failed to retrieve annotation:', err);
    res.status(500).json({ error: 'Failed to retrieve annotation' });
  }
});

// ── DELETE /api/ml/annotations/:id ───────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Delete files
    for (const suffix of ['', '_mask']) {
      const fp = getStoragePath(id, suffix);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }

    if (await isDbAvailable()) {
      const query = await getQuery();
      await query('DELETE FROM ml_annotations WHERE id = $1', [id]);
    }

    res.json({ deleted: true });
  } catch (err) {
    console.error('Failed to delete annotation:', err);
    res.status(500).json({ error: 'Failed to delete annotation' });
  }
});

// ── POST /api/ml/annotations/:id/corrections ─────────────────────────────────

router.post('/:id/corrections', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { maskBase64, imageBase64 } = req.body;

    if (!maskBase64) {
      res.status(400).json({ error: 'maskBase64 is required' });
      return;
    }

    const corrId = randomUUID();

    // Save corrected mask
    saveImage(corrId, maskBase64, '_mask');

    // Save or copy image
    if (imageBase64) {
      saveImage(corrId, imageBase64);
    } else {
      // Copy original image if exists
      const origPath = getStoragePath(id);
      const newPath = getStoragePath(corrId);
      if (fs.existsSync(origPath)) {
        fs.copyFileSync(origPath, newPath);
      }
    }

    if (await isDbAvailable()) {
      const query = await getQuery();
      const userId = (req as any).user?.id || null;
      await query(
        `INSERT INTO ml_annotations (id, user_id, source, status, image_path, mask_path, parent_id, training_weight)
         VALUES ($1, $2, 'correction', 'approved', $3, $4, $5, 3.0)`,
        [corrId, userId, getStoragePath(corrId), getStoragePath(corrId, '_mask'), id]
      );
    }

    res.json({ id: corrId });
  } catch (err) {
    console.error('Failed to save correction:', err);
    res.status(500).json({ error: 'Failed to save correction' });
  }
});

// ── POST /api/ml/annotations/auto-save-drawing ──────────────────────────────

router.post('/auto-save-drawing', async (req: Request, res: Response) => {
  try {
    const { imageBase64, vertices, edges, bounds, address } = req.body;

    if (!imageBase64 || !vertices || !edges || !bounds) {
      res.status(400).json({ error: 'imageBase64, vertices, edges, and bounds are required' });
      return;
    }

    if (edges.length < 3) {
      res.json({ saved: false, message: 'Not enough edges (minimum 3)' });
      return;
    }

    const id = randomUUID();

    // Save satellite image
    const imagePath = saveImage(id, imageBase64);

    // Render edge mask via correctionExporter
    let maskPath = '';
    try {
      const { renderCorrectionMask } = await import('../ml/correctionExporter.js');
      const correctionData = {
        vertices: vertices.map((v: { lat: number; lng: number }) => ({ lat: v.lat, lng: v.lng })),
        edges: edges.map((e: { startVertexId: string; endVertexId: string; type: string }) => ({
          startVertexId: e.startVertexId,
          endVertexId: e.endVertexId,
          type: e.type,
        })),
      };
      const mask = renderCorrectionMask(correctionData, bounds);

      // Save mask as raw data (JSON format that Python can read)
      maskPath = path.join(STORAGE_DIR, `${id}_mask_raw.json`);
      fs.writeFileSync(maskPath, JSON.stringify({
        width: 640, height: 640,
        data: Array.from(mask),
      }));
    } catch (err) {
      console.warn('[MLTraining] Could not render mask:', err);
    }

    // Save to PostgreSQL
    if (await isDbAvailable()) {
      const query = await getQuery();
      const userId = (req as any).user?.id || null;

      // Insert annotation record
      await query(
        `INSERT INTO ml_annotations
           (id, user_id, address, source, status, image_path, mask_path,
            bounds_north, bounds_south, bounds_east, bounds_west,
            edge_count, vertex_count, training_weight)
         VALUES ($1, $2, $3, 'user-drawing', 'approved', $4, $5,
                 $6, $7, $8, $9, $10, $11, 3.0)`,
        [
          id, userId, address || '',
          imagePath, maskPath,
          bounds.north, bounds.south, bounds.east, bounds.west,
          edges.length, vertices.length,
        ]
      );

      // Insert vertices
      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        await query(
          `INSERT INTO ml_annotation_vertices (annotation_id, vertex_index, lat, lng)
           VALUES ($1, $2, $3, $4)`,
          [id, i, v.lat, v.lng]
        );
      }

      // Insert edges
      for (const e of edges) {
        await query(
          `INSERT INTO ml_annotation_edges (annotation_id, start_vertex_idx, end_vertex_idx, edge_type, length_ft)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, e.startVertexId, e.endVertexId, e.type, e.lengthFt || 0]
        );
      }
    }

    console.info(`[MLTraining] Auto-saved drawing: ${edges.length} edges, address=${address}`);
    res.json({ saved: true, annotationId: id });
  } catch (err) {
    console.error('Failed to auto-save drawing:', err);
    res.status(500).json({ error: 'Failed to save drawing as training data' });
  }
});

// ── GET /api/ml/annotations/stats ────────────────────────────────────────────

router.get('/stats/summary', async (_req: Request, res: Response) => {
  try {
    if (await isDbAvailable()) {
      const query = await getQuery();
      const result = await query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE source = 'user-drawing') AS user_drawings,
          COUNT(*) FILTER (WHERE source = 'correction') AS corrections,
          COUNT(*) FILTER (WHERE source = 'manual') AS manual,
          COUNT(*) FILTER (WHERE source = 'cv-auto') AS cv_auto,
          COUNT(*) FILTER (WHERE status = 'approved') AS approved,
          COUNT(*) FILTER (WHERE used_in_training) AS used_in_training,
          AVG(edge_count) AS avg_edges,
          AVG(vertex_count) AS avg_vertices
        FROM ml_annotations
      `);
      res.json(result.rows[0]);
    } else {
      res.json({ total: 0 });
    }
  } catch (err) {
    console.error('Failed to get stats:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export { router as mlTrainingRouter };
