import { Router, type Request, type Response } from 'express';
import { query } from '../db/index.js';

const router = Router();

interface AuthUser {
  userId: string;
  username: string;
}

function getUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// ─── LIST NOTIFICATIONS ──────────────────────────────────────────
// GET /api/notifications
// Query: ?limit=50&offset=0&unread_only=false
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
    const unreadOnly = req.query.unread_only === 'true';

    const conditions = ['n.user_id = $1'];
    const params: unknown[] = [user.userId];

    if (unreadOnly) {
      conditions.push('n.read = FALSE');
    }

    const where = conditions.join(' AND ');

    const sql = `
      SELECT id, type, title, message, priority, read, action_url, metadata, created_at
      FROM notifications n
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Unread count (always return this regardless of filter)
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = FALSE',
      [user.userId],
    );
    const unreadCount = parseInt(countResult.rows[0].count, 10);

    res.json({
      notifications: result.rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        priority: row.priority,
        read: row.read,
        actionUrl: row.action_url,
        metadata: row.metadata,
        createdAt: row.created_at,
      })),
      unreadCount,
    });
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ error: 'Failed to list notifications' });
  }
});

// ─── GET UNREAD COUNT ────────────────────────────────────────────
// GET /api/notifications/unread-count
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = FALSE',
      [user.userId],
    );
    res.json({ unreadCount: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// ─── MARK NOTIFICATION AS READ ───────────────────────────────────
// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const result = await query(
      'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user.userId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// ─── MARK ALL AS READ ────────────────────────────────────────────
// POST /api/notifications/mark-all-read
router.post('/mark-all-read', async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const result = await query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE',
      [user.userId],
    );
    res.json({ success: true, count: result.rowCount });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// ─── DELETE NOTIFICATION ─────────────────────────────────────────
// DELETE /api/notifications/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const result = await query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user.userId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// ─── CLEAR ALL NOTIFICATIONS ─────────────────────────────────────
// DELETE /api/notifications
router.delete('/', async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const result = await query(
      'DELETE FROM notifications WHERE user_id = $1',
      [user.userId],
    );
    res.json({ success: true, count: result.rowCount });
  } catch (err) {
    console.error('Clear notifications error:', err);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// ─── CREATE NOTIFICATION (internal/server-side) ──────────────────
// POST /api/notifications
// Body: { type, title, message, priority?, actionUrl?, metadata? }
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { type, title, message, priority, actionUrl, metadata } = req.body;

    if (!type || !title || !message) {
      res.status(400).json({ error: 'type, title, and message are required' });
      return;
    }

    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, priority, action_url, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, type, title, message, priority, read, action_url, metadata, created_at`,
      [
        user.userId,
        type,
        title,
        message,
        priority || 'normal',
        actionUrl || null,
        metadata ? JSON.stringify(metadata) : '{}',
      ],
    );

    const row = result.rows[0] as Record<string, unknown>;
    res.status(201).json({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      priority: row.priority,
      read: row.read,
      actionUrl: row.action_url,
      metadata: row.metadata,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('Create notification error:', err);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

export { router as notificationRouter };
