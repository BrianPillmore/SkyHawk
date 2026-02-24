import { Router, type Request, type Response } from 'express';
import { query } from '../db/index.js';
import { requireFields, requireUuidParam } from '../middleware/validate.js';

const router = Router();

type AuthUser = { username: string; userId?: string };
type AuthRequest = Request & { user: AuthUser };

/** Helper: get user ID from username */
async function getUserId(username: string): Promise<string> {
  const result = await query<{ id: string }>(
    'SELECT id FROM users WHERE username = $1',
    [username],
  );
  if (result.rows.length === 0) {
    throw new Error(`User not found: ${username}`);
  }
  return result.rows[0].id;
}

// ─── CREATE REPORTS TABLE (idempotent, runs on first use) ──────────
// Note: In production this would be in a migration file.
// We use a simple approach: try to create if not exists on module load.
const ensureReportsTable = async (): Promise<void> => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS reports (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        title         VARCHAR(500) NOT NULL,
        status        VARCHAR(20) DEFAULT 'pending',
        format        VARCHAR(20) DEFAULT 'pdf',
        options       JSONB DEFAULT '{}',
        file_path     VARCHAR(1000),
        file_size     BIGINT DEFAULT 0,
        generated_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_reports_property ON reports(property_id)');
  } catch (err) {
    // Table creation is best-effort; may fail if no DB
    console.warn('Reports table creation skipped:', err);
  }
};

// Fire and forget table creation
let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (!tableEnsured) {
    await ensureReportsTable();
    tableEnsured = true;
  }
}

// ─── GENERATE REPORT (STUB) ───────────────────────────────────────
// POST /api/reports/generate
// Body: { property_id, title?, options?: { include_measurements?, include_images?, include_damage? } }
router.post(
  '/generate',
  requireFields('property_id'),
  async (req: Request, res: Response) => {
    try {
      await ensureTable();
      const { username } = (req as AuthRequest).user;
      const userId = await getUserId(username);
      const { property_id, title, options } = req.body;

      // Verify user owns the property
      const propResult = await query(
        'SELECT id, address FROM properties WHERE id = $1 AND user_id = $2',
        [property_id, userId],
      );

      if (propResult.rows.length === 0) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const property = propResult.rows[0] as { id: string; address: string };
      const reportTitle = title || `Report - ${property.address}`;
      const reportOptions = options || {};

      // Create report record with 'pending' status
      // Actual PDF generation is client-side; this stores metadata
      const result = await query(
        `INSERT INTO reports (user_id, property_id, title, status, options)
         VALUES ($1, $2, $3, 'completed', $4)
         RETURNING id, user_id, property_id, title, status, format, options, created_at, updated_at`,
        [userId, property_id, reportTitle, JSON.stringify(reportOptions)],
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Generate report error:', err);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  },
);

// ─── LIST REPORTS ──────────────────────────────────────────────────
// GET /api/reports
// Query: ?page=1&limit=20&property_id=...
router.get('/', async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;
    const propertyId = req.query.property_id as string | undefined;

    let sql = `
      SELECT r.id, r.property_id, r.title, r.status, r.format, r.options,
             r.file_size, r.generated_at, r.created_at, r.updated_at,
             p.address as property_address
      FROM reports r
      JOIN properties p ON p.id = r.property_id
      WHERE r.user_id = $1
    `;
    const params: unknown[] = [userId];

    if (propertyId) {
      params.push(propertyId);
      sql += ` AND r.property_id = $${params.length}`;
    }

    sql += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM reports WHERE user_id = $1';
    const countParams: unknown[] = [userId];
    if (propertyId) {
      countParams.push(propertyId);
      countSql += ` AND property_id = $${countParams.length}`;
    }
    const countResult = await query<{ total: string }>(countSql, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    res.json({
      reports: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('List reports error:', err);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

// ─── GET REPORT ────────────────────────────────────────────────────
// GET /api/reports/:id
router.get('/:id', requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const result = await query(
      `SELECT r.id, r.property_id, r.title, r.status, r.format, r.options,
              r.file_path, r.file_size, r.generated_at, r.created_at, r.updated_at,
              p.address as property_address
       FROM reports r
       JOIN properties p ON p.id = r.property_id
       WHERE r.id = $1 AND r.user_id = $2`,
      [reportId, userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get report error:', err);
    res.status(500).json({ error: 'Failed to get report' });
  }
});

// ─── DOWNLOAD REPORT ───────────────────────────────────────────────
// GET /api/reports/:id/download
// Stub: returns metadata with a message that PDF generation is client-side
router.get('/:id/download', requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const result = await query(
      `SELECT r.id, r.title, r.status, r.file_path, r.format
       FROM reports r
       WHERE r.id = $1 AND r.user_id = $2`,
      [reportId, userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const report = result.rows[0] as { id: string; title: string; status: string; file_path: string | null; format: string };

    if (!report.file_path) {
      // PDF generation is client-side; the server stores metadata only
      res.status(202).json({
        message: 'Report PDF is generated client-side. Use the client SDK to generate and download.',
        reportId: report.id,
        status: report.status,
      });
      return;
    }

    // If a file_path exists, indicate where to download from
    // In production this would stream the file or return a signed URL
    res.json({
      reportId: report.id,
      title: report.title,
      format: report.format,
      downloadUrl: `/api/reports/${report.id}/file`,
    });
  } catch (err) {
    console.error('Download report error:', err);
    res.status(500).json({ error: 'Failed to download report' });
  }
});

// ─── DELETE REPORT ─────────────────────────────────────────────────
// DELETE /api/reports/:id
router.delete('/:id', requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const result = await query(
      'DELETE FROM reports WHERE id = $1 AND user_id = $2 RETURNING id',
      [reportId, userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    res.json({ deleted: true, id: reportId });
  } catch (err) {
    console.error('Delete report error:', err);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

export { router as reportsRouter };
