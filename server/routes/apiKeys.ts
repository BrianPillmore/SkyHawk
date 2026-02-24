import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { requireFields, requireUuidParam } from '../middleware/validate.js';

const router = Router();

/** Valid API key permissions */
const VALID_PERMISSIONS = [
  'properties.read',
  'properties.write',
  'measurements.read',
  'measurements.write',
  'reports.generate',
] as const;

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

// ─── LIST API KEYS ─────────────────────────────────────────────────
// GET /api/api-keys
// Returns user's API keys with prefix only (never the full key).
router.get('/', async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);

    const result = await query(
      `SELECT id, name, prefix, permissions, last_used_at, expires_at, created_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    res.json({ apiKeys: result.rows });
  } catch (err) {
    console.error('List API keys error:', err);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// ─── CREATE API KEY ────────────────────────────────────────────────
// POST /api/api-keys
// Body: { name, permissions?: string[], expires_at?: string }
// Returns the full key ONCE. It cannot be retrieved again.
router.post(
  '/',
  requireFields('name'),
  async (req: Request, res: Response) => {
    try {
      const { username } = (req as AuthRequest).user;
      const userId = await getUserId(username);
      const { name, permissions, expires_at } = req.body;

      // Validate permissions
      const perms: string[] = permissions || [];
      for (const perm of perms) {
        if (!VALID_PERMISSIONS.includes(perm as typeof VALID_PERMISSIONS[number])) {
          res.status(400).json({
            error: `Invalid permission: ${perm}`,
            validPermissions: VALID_PERMISSIONS,
          });
          return;
        }
      }

      // Generate the API key: sk_live_ + 32 hex chars
      const randomPart = crypto.randomBytes(16).toString('hex');
      const fullKey = `sk_live_${randomPart}`;
      const prefix = randomPart.slice(0, 8);

      // Hash the full key for storage
      const keyHash = await bcrypt.hash(fullKey, 10);

      // Validate expiration date if provided
      let expiresAt: string | null = null;
      if (expires_at) {
        const date = new Date(expires_at);
        if (isNaN(date.getTime())) {
          res.status(400).json({ error: 'Invalid expires_at date' });
          return;
        }
        expiresAt = date.toISOString();
      }

      const result = await query(
        `INSERT INTO api_keys (user_id, name, key_hash, prefix, permissions, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, prefix, permissions, expires_at, created_at`,
        [userId, name, keyHash, prefix, JSON.stringify(perms), expiresAt],
      );

      // Return the full key ONCE along with the record metadata
      res.status(201).json({
        ...result.rows[0],
        key: fullKey,
        warning: 'Store this key securely. It will not be shown again.',
      });
    } catch (err) {
      console.error('Create API key error:', err);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  },
);

// ─── UPDATE API KEY ────────────────────────────────────────────────
// PUT /api/api-keys/:id
// Body: { name?, permissions? }
router.put(
  '/:id',
  requireUuidParam('id'),
  async (req: Request, res: Response) => {
    try {
      const { username } = (req as AuthRequest).user;
      const userId = await getUserId(username);
      const keyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { name, permissions } = req.body;

      // Validate permissions if provided
      if (permissions) {
        for (const perm of permissions) {
          if (!VALID_PERMISSIONS.includes(perm as typeof VALID_PERMISSIONS[number])) {
            res.status(400).json({
              error: `Invalid permission: ${perm}`,
              validPermissions: VALID_PERMISSIONS,
            });
            return;
          }
        }
      }

      const result = await query(
        `UPDATE api_keys
         SET name = COALESCE($3, name),
             permissions = COALESCE($4, permissions)
         WHERE id = $1 AND user_id = $2
         RETURNING id, name, prefix, permissions, last_used_at, expires_at, created_at`,
        [keyId, userId, name || null, permissions ? JSON.stringify(permissions) : null],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error('Update API key error:', err);
      res.status(500).json({ error: 'Failed to update API key' });
    }
  },
);

// ─── REVOKE (DELETE) API KEY ───────────────────────────────────────
// DELETE /api/api-keys/:id
router.delete(
  '/:id',
  requireUuidParam('id'),
  async (req: Request, res: Response) => {
    try {
      const { username } = (req as AuthRequest).user;
      const userId = await getUserId(username);
      const keyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const result = await query(
        'DELETE FROM api_keys WHERE id = $1 AND user_id = $2 RETURNING id',
        [keyId, userId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      res.json({ deleted: true, id: keyId });
    } catch (err) {
      console.error('Delete API key error:', err);
      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  },
);

export { router as apiKeysRouter };
