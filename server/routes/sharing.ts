import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { query } from '../db/index.js';
import { requireFields, requireUuidParam } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthPayload } from '../middleware/auth.js';

const router = Router();

type AuthRequest = Request & { user: AuthPayload };

/** Extract a single string param from Express params */
function p(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

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

/** Generate a random 32-character share token */
function generateShareToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// ─── SHARE PROPERTY / REPORT ────────────────────────────────────────
// POST /api/properties/:id/share
router.post(
  '/properties/:id/share',
  requireAuth,
  requireUuidParam('id'),
  async (req: Request, res: Response) => {
    try {
      const { username } = (req as AuthRequest).user;
      const userId = await getUserId(username);
      const propertyId = p(req, 'id');

      // Verify ownership of the property
      const propResult = await query(
        'SELECT id FROM properties WHERE id = $1 AND user_id = $2',
        [propertyId, userId],
      );

      if (propResult.rows.length === 0) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const { email, permissions, expiresAt } = req.body;
      const sharePermissions = permissions || 'view';
      const shareToken = generateShareToken();

      // Look up the recipient user if email is provided
      let sharedWithUserId: string | null = null;
      if (email) {
        const recipientResult = await query<{ id: string }>(
          'SELECT id FROM users WHERE email = $1',
          [email],
        );
        if (recipientResult.rows.length > 0) {
          sharedWithUserId = recipientResult.rows[0].id;
        }
      }

      const result = await query(
        `INSERT INTO shared_reports (property_id, shared_by, shared_with_email, shared_with_user, share_token, permissions, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, property_id, shared_with_email, share_token, permissions, expires_at, created_at`,
        [propertyId, userId, email || null, sharedWithUserId, shareToken, sharePermissions, expiresAt || null],
      );

      // Log the action
      await query(
        `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'report.share', 'property', propertyId, `Shared property with ${email || 'link'}`],
      );

      res.status(201).json({
        ...result.rows[0],
        shareUrl: `/shared/${shareToken}`,
      });
    } catch (err) {
      console.error('Share property error:', err);
      res.status(500).json({ error: 'Failed to share property' });
    }
  },
);

// ─── ACCESS SHARED REPORT (PUBLIC) ──────────────────────────────────
// GET /api/shared/:token — no auth required
router.get('/shared/:token', async (req: Request, res: Response) => {
  try {
    const token = p(req, 'token');

    const shareResult = await query(
      `SELECT sr.id, sr.property_id, sr.shared_by, sr.shared_with_email,
              sr.permissions, sr.expires_at, sr.created_at,
              u.username AS shared_by_username
       FROM shared_reports sr
       JOIN users u ON u.id = sr.shared_by
       WHERE sr.share_token = $1`,
      [token],
    );

    if (shareResult.rows.length === 0) {
      res.status(404).json({ error: 'Shared report not found' });
      return;
    }

    const share = shareResult.rows[0];

    // Check expiration
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      res.status(410).json({ error: 'This share link has expired' });
      return;
    }

    // Fetch the property data
    const propertyResult = await query(
      `SELECT id, address, city, state, zip, lat, lng, notes, created_at, updated_at
       FROM properties WHERE id = $1`,
      [share.property_id],
    );

    if (propertyResult.rows.length === 0) {
      res.status(404).json({ error: 'Property no longer exists' });
      return;
    }

    // Fetch measurements
    const measurementsResult = await query(
      `SELECT id, total_area_sqft, total_true_area_sqft, total_squares,
              predominant_pitch, suggested_waste_percent, structure_complexity,
              data_source, created_at, updated_at
       FROM roof_measurements
       WHERE property_id = $1
       ORDER BY created_at DESC`,
      [share.property_id],
    );

    // Fetch damage annotations
    const damageResult = await query(
      `SELECT id, lat, lng, type, severity, note, created_at
       FROM damage_annotations
       WHERE property_id = $1
       ORDER BY created_at DESC`,
      [share.property_id],
    );

    res.json({
      share: {
        id: share.id,
        permissions: share.permissions,
        sharedByUsername: share.shared_by_username,
        expiresAt: share.expires_at,
        createdAt: share.created_at,
      },
      property: propertyResult.rows[0],
      measurements: measurementsResult.rows,
      damageAnnotations: damageResult.rows,
    });
  } catch (err) {
    console.error('Access shared report error:', err);
    res.status(500).json({ error: 'Failed to access shared report' });
  }
});

// ─── LIST MY SHARES ─────────────────────────────────────────────────
// GET /api/shared
router.get('/shared', requireAuth, async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);

    const result = await query(
      `SELECT sr.id, sr.property_id, sr.shared_with_email, sr.share_token,
              sr.permissions, sr.expires_at, sr.created_at,
              p.address AS property_address,
              u.username AS shared_by_username
       FROM shared_reports sr
       JOIN properties p ON p.id = sr.property_id
       JOIN users u ON u.id = sr.shared_by
       WHERE sr.shared_by = $1
       ORDER BY sr.created_at DESC`,
      [userId],
    );

    res.json({ shares: result.rows });
  } catch (err) {
    console.error('List shares error:', err);
    res.status(500).json({ error: 'Failed to list shares' });
  }
});

// ─── REVOKE SHARE ───────────────────────────────────────────────────
// DELETE /api/shared/:id
router.delete('/shared/:id', requireAuth, requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const shareId = p(req, 'id');

    const result = await query(
      `DELETE FROM shared_reports
       WHERE id = $1 AND shared_by = $2
       RETURNING id`,
      [shareId, userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Share not found' });
      return;
    }

    // Log the action
    await query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'report.unshare', 'shared_report', shareId, 'Revoked share link'],
    );

    res.json({ deleted: true, id: shareId });
  } catch (err) {
    console.error('Revoke share error:', err);
    res.status(500).json({ error: 'Failed to revoke share' });
  }
});

export { router as sharingRouter };
