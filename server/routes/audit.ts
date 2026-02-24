import { Router, type Request, type Response } from 'express';
import { query } from '../db/index.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// ─── LIST AUDIT LOG ENTRIES ────────────────────────────────────────
// GET /api/audit-log
// Query: ?page=1&limit=50&user_id=...&action=...&resource_type=...&from=...&to=...
// Requires admin or manager role.
router.get(
  '/',
  requireRole('admin', 'manager'),
  async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
      const offset = (page - 1) * limit;

      // Build dynamic WHERE clause from filters
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (req.query.user_id) {
        params.push(req.query.user_id);
        conditions.push(`al.user_id = $${params.length}`);
      }

      if (req.query.action) {
        params.push(req.query.action);
        conditions.push(`al.action = $${params.length}`);
      }

      if (req.query.resource_type) {
        params.push(req.query.resource_type);
        conditions.push(`al.resource_type = $${params.length}`);
      }

      if (req.query.from) {
        const fromDate = new Date(req.query.from as string);
        if (isNaN(fromDate.getTime())) {
          res.status(400).json({ error: 'Invalid "from" date' });
          return;
        }
        params.push(fromDate.toISOString());
        conditions.push(`al.created_at >= $${params.length}`);
      }

      if (req.query.to) {
        const toDate = new Date(req.query.to as string);
        if (isNaN(toDate.getTime())) {
          res.status(400).json({ error: 'Invalid "to" date' });
          return;
        }
        params.push(toDate.toISOString());
        conditions.push(`al.created_at <= $${params.length}`);
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      // Main query with user join for username
      const sql = `
        SELECT al.id, al.user_id, u.username, al.action, al.resource_type,
               al.resource_id, al.details, al.ip_address, al.created_at
        FROM audit_log al
        LEFT JOIN users u ON u.id = al.user_id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const result = await query(sql, params);

      // Count query for pagination
      const countSql = `SELECT COUNT(*) as total FROM audit_log al ${whereClause}`;
      // Count uses same filter params (without limit/offset)
      const countParams = params.slice(0, params.length - 2);
      const countResult = await query<{ total: string }>(countSql, countParams);
      const total = parseInt(countResult.rows[0].total, 10);

      res.json({
        entries: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error('List audit log error:', err);
      res.status(500).json({ error: 'Failed to list audit log entries' });
    }
  },
);

// ─── EXPORT AUDIT LOG AS CSV ───────────────────────────────────────
// GET /api/audit-log/export
// Query: same filters as list endpoint
// Requires admin role only.
router.get(
  '/export',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      // Build dynamic WHERE clause from filters
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (req.query.user_id) {
        params.push(req.query.user_id);
        conditions.push(`al.user_id = $${params.length}`);
      }

      if (req.query.action) {
        params.push(req.query.action);
        conditions.push(`al.action = $${params.length}`);
      }

      if (req.query.resource_type) {
        params.push(req.query.resource_type);
        conditions.push(`al.resource_type = $${params.length}`);
      }

      if (req.query.from) {
        const fromDate = new Date(req.query.from as string);
        if (isNaN(fromDate.getTime())) {
          res.status(400).json({ error: 'Invalid "from" date' });
          return;
        }
        params.push(fromDate.toISOString());
        conditions.push(`al.created_at >= $${params.length}`);
      }

      if (req.query.to) {
        const toDate = new Date(req.query.to as string);
        if (isNaN(toDate.getTime())) {
          res.status(400).json({ error: 'Invalid "to" date' });
          return;
        }
        params.push(toDate.toISOString());
        conditions.push(`al.created_at <= $${params.length}`);
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      // Limit export to 10,000 rows to prevent memory issues
      const sql = `
        SELECT al.id, al.user_id, u.username, al.action, al.resource_type,
               al.resource_id, al.details, al.ip_address, al.created_at
        FROM audit_log al
        LEFT JOIN users u ON u.id = al.user_id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT 10000
      `;

      const result = await query(sql, params);

      // Build CSV
      const headers = [
        'id', 'user_id', 'username', 'action', 'resource_type',
        'resource_id', 'details', 'ip_address', 'created_at',
      ];

      const csvRows = [headers.join(',')];

      for (const row of result.rows) {
        const r = row as Record<string, unknown>;
        const values = headers.map((h) => {
          const val = r[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          // Escape CSV values that contain commas, quotes, or newlines
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        csvRows.push(values.join(','));
      }

      const csv = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (err) {
      console.error('Export audit log error:', err);
      res.status(500).json({ error: 'Failed to export audit log' });
    }
  },
);

export { router as auditRouter };
