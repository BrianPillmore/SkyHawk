import { type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';

/**
 * Shape attached to `req.apiKey` when API key auth succeeds.
 */
export interface ApiKeyInfo {
  id: string;
  name: string;
  permissions: string[];
  userId: string;
}

/**
 * API key authentication middleware.
 *
 * Checks for an `X-API-Key` header. If present:
 *   1. Extracts the prefix (first 8 chars after `sk_live_`) to narrow down candidates.
 *   2. Hashes and compares with bcrypt against stored key_hash.
 *   3. Validates the key has not expired.
 *   4. Sets `req.user` from the key owner and `req.apiKey` with key metadata.
 *   5. Updates `last_used_at` timestamp.
 *
 * If no `X-API-Key` header is present, falls through to the next middleware
 * (typically JWT auth) without error.
 */
export async function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKey = req.headers['x-api-key'];

  // No API key header — fall through to JWT auth
  if (!apiKey || typeof apiKey !== 'string') {
    next();
    return;
  }

  try {
    // Validate key format: sk_live_ + 32 hex chars = 40 chars total after prefix
    if (!apiKey.startsWith('sk_live_') || apiKey.length !== 40) {
      res.status(401).json({ error: 'Invalid API key format' });
      return;
    }

    // Extract the prefix used for lookup (first 8 chars of the random portion)
    const prefix = apiKey.slice(8, 16);

    // Find candidate keys by prefix
    const candidates = await query<{
      id: string;
      user_id: string;
      name: string;
      key_hash: string;
      permissions: string[];
      expires_at: string | null;
    }>(
      `SELECT ak.id, ak.user_id, ak.name, ak.key_hash, ak.permissions, ak.expires_at
       FROM api_keys ak
       WHERE ak.prefix = $1`,
      [prefix],
    );

    if (candidates.rows.length === 0) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Compare the full key against each candidate's hash
    let matchedKey: (typeof candidates.rows)[0] | null = null;
    for (const candidate of candidates.rows) {
      const valid = await bcrypt.compare(apiKey, candidate.key_hash);
      if (valid) {
        matchedKey = candidate;
        break;
      }
    }

    if (!matchedKey) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Check expiration
    if (matchedKey.expires_at) {
      const expiresAt = new Date(matchedKey.expires_at);
      if (expiresAt < new Date()) {
        res.status(401).json({ error: 'API key has expired' });
        return;
      }
    }

    // Look up the key owner
    const userResult = await query<{
      id: string;
      username: string;
      role: string;
    }>(
      'SELECT id, username, role FROM users WHERE id = $1',
      [matchedKey.user_id],
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({ error: 'API key owner not found' });
      return;
    }

    const owner = userResult.rows[0];

    // Set req.user and req.apiKey
    const extReq = req as Request & {
      user: { username: string; userId: string; role: string };
      apiKey: ApiKeyInfo;
    };

    extReq.user = {
      username: owner.username,
      userId: owner.id,
      role: owner.role,
    };

    extReq.apiKey = {
      id: matchedKey.id,
      name: matchedKey.name,
      permissions: matchedKey.permissions || [],
      userId: matchedKey.user_id,
    };

    // Update last_used_at (fire and forget)
    query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [matchedKey.id],
    ).catch((err) => {
      console.warn('Failed to update API key last_used_at:', err);
    });

    next();
  } catch (err) {
    console.error('API key auth error:', err);
    res.status(500).json({ error: 'Internal server error during API key authentication' });
  }
}

/**
 * Middleware to check that the current API key (if used) has the required permission.
 * If the request was authenticated via JWT (no req.apiKey), it passes through.
 */
export function requireApiKeyPermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const extReq = req as Request & { apiKey?: ApiKeyInfo };

    // If not an API key request, let it through (JWT users have full access)
    if (!extReq.apiKey) {
      next();
      return;
    }

    if (!extReq.apiKey.permissions.includes(permission)) {
      res.status(403).json({
        error: 'API key lacks required permission',
        required: permission,
        granted: extReq.apiKey.permissions,
      });
      return;
    }

    next();
  };
}
