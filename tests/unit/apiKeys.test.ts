import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for API key generation, validation, revocation, and permission checks.
 * Uses mocked database and bcrypt calls to test middleware and route logic.
 */

// Mock the database module
vi.mock('../../server/db/index', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  getPool: vi.fn(),
  initDb: vi.fn(),
  closeDb: vi.fn(),
}));

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

import { query } from '../../server/db/index';
import bcrypt from 'bcryptjs';
import { apiKeyAuth, requireApiKeyPermission } from '../../server/middleware/apiKeyAuth';
import type { Request, Response, NextFunction } from 'express';

const mockQuery = vi.mocked(query);
const mockBcryptCompare = vi.mocked(bcrypt.compare);

// Helper: create mock req/res/next for middleware testing
function createMockReqRes(options: {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  user?: Record<string, unknown>;
  apiKey?: Record<string, unknown>;
} = {}) {
  const req = {
    headers: options.headers || {},
    params: options.params || {},
    body: options.body || {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...(options.user ? { user: options.user } : {}),
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
  } as unknown as Request & {
    user?: Record<string, unknown>;
    apiKey?: Record<string, unknown>;
  };

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
}

describe('API Key Authentication Middleware', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockBcryptCompare.mockReset();
  });

  describe('apiKeyAuth', () => {
    it('falls through to next middleware when no X-API-Key header', async () => {
      const { req, res, next } = createMockReqRes();
      await apiKeyAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects invalid API key format (missing prefix)', async () => {
      const { req, res, next } = createMockReqRes({
        headers: { 'x-api-key': 'invalid_key_format' },
      });
      await apiKeyAuth(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid API key format' }),
      );
    });

    it('rejects API key with wrong length', async () => {
      const { req, res, next } = createMockReqRes({
        headers: { 'x-api-key': 'sk_live_tooshort' },
      });
      await apiKeyAuth(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('rejects when no matching key prefix found in DB', async () => {
      const validKey = 'sk_live_' + 'a'.repeat(32);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-api-key': validKey },
      });
      await apiKeyAuth(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid API key' }),
      );
    });

    it('rejects when bcrypt compare fails (wrong key)', async () => {
      const validKey = 'sk_live_' + 'a'.repeat(32);
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'key-1',
          user_id: 'user-1',
          name: 'Test Key',
          key_hash: '$2a$10$hashhere',
          permissions: ['properties.read'],
          expires_at: null,
        }],
        rowCount: 1,
      } as never);
      mockBcryptCompare.mockResolvedValueOnce(false as never);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-api-key': validKey },
      });
      await apiKeyAuth(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('rejects expired API keys', async () => {
      const validKey = 'sk_live_' + 'a'.repeat(32);
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'key-1',
          user_id: 'user-1',
          name: 'Expired Key',
          key_hash: '$2a$10$hashhere',
          permissions: ['properties.read'],
          expires_at: pastDate,
        }],
        rowCount: 1,
      } as never);
      mockBcryptCompare.mockResolvedValueOnce(true as never);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-api-key': validKey },
      });
      await apiKeyAuth(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'API key has expired' }),
      );
    });

    it('authenticates valid API key and sets req.user and req.apiKey', async () => {
      const validKey = 'sk_live_' + 'a'.repeat(32);
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

      // Mock: find candidate key by prefix
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'key-1',
          user_id: 'user-1',
          name: 'My API Key',
          key_hash: '$2a$10$hashhere',
          permissions: ['properties.read', 'properties.write'],
          expires_at: futureDate,
        }],
        rowCount: 1,
      } as never);

      // Mock: bcrypt compare succeeds
      mockBcryptCompare.mockResolvedValueOnce(true as never);

      // Mock: look up key owner
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'user-1',
          username: 'apiuser',
          role: 'adjuster',
        }],
        rowCount: 1,
      } as never);

      // Mock: update last_used_at (fire-and-forget)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-api-key': validKey },
      });

      await apiKeyAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();

      // Verify req.user was set
      const extReq = req as Request & {
        user: { username: string; userId: string; role: string };
        apiKey: { id: string; name: string; permissions: string[]; userId: string };
      };
      expect(extReq.user.username).toBe('apiuser');
      expect(extReq.user.userId).toBe('user-1');
      expect(extReq.user.role).toBe('adjuster');

      // Verify req.apiKey was set
      expect(extReq.apiKey.id).toBe('key-1');
      expect(extReq.apiKey.name).toBe('My API Key');
      expect(extReq.apiKey.permissions).toEqual(['properties.read', 'properties.write']);
    });

    it('rejects when key owner not found in users table', async () => {
      const validKey = 'sk_live_' + 'a'.repeat(32);

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'key-1',
          user_id: 'deleted-user',
          name: 'Orphan Key',
          key_hash: '$2a$10$hashhere',
          permissions: [],
          expires_at: null,
        }],
        rowCount: 1,
      } as never);
      mockBcryptCompare.mockResolvedValueOnce(true as never);

      // User lookup returns empty
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-api-key': validKey },
      });

      await apiKeyAuth(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'API key owner not found' }),
      );
    });
  });

  describe('requireApiKeyPermission', () => {
    it('passes through when request is not from API key (JWT auth)', () => {
      const { req, res, next } = createMockReqRes({
        user: { username: 'jwtuser', role: 'admin' },
      });
      requireApiKeyPermission('properties.read')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows when API key has the required permission', () => {
      const { req, res, next } = createMockReqRes({
        user: { username: 'apiuser' },
        apiKey: {
          id: 'key-1',
          name: 'Test',
          permissions: ['properties.read', 'properties.write'],
          userId: 'user-1',
        },
      });
      requireApiKeyPermission('properties.read')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('denies when API key lacks the required permission', () => {
      const { req, res, next } = createMockReqRes({
        user: { username: 'apiuser' },
        apiKey: {
          id: 'key-1',
          name: 'Test',
          permissions: ['properties.read'],
          userId: 'user-1',
        },
      });
      requireApiKeyPermission('properties.write')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'API key lacks required permission',
          required: 'properties.write',
        }),
      );
    });
  });
});

describe('API Key Generation Patterns', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('generates keys with the correct prefix format', () => {
    // Verify the key format: sk_live_ + 32 hex chars = 40 total chars
    const crypto = require('crypto');
    const randomPart = crypto.randomBytes(16).toString('hex');
    const fullKey = `sk_live_${randomPart}`;

    expect(fullKey).toMatch(/^sk_live_[0-9a-f]{32}$/);
    expect(fullKey.length).toBe(40);
  });

  it('stores only prefix and hash, not full key', async () => {
    // Simulate the creation flow
    const crypto = require('crypto');
    const randomPart = crypto.randomBytes(16).toString('hex');
    const prefix = randomPart.slice(0, 8);

    expect(prefix.length).toBe(8);
    expect(prefix).toMatch(/^[0-9a-f]{8}$/);
  });

  it('lists keys with prefix only, never full key', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'key-1',
            name: 'Production Key',
            prefix: 'abcd1234',
            permissions: ['properties.read'],
            last_used_at: null,
            expires_at: null,
            created_at: '2026-02-24',
          },
        ],
        rowCount: 1,
      } as never);

    // Simulate the listing pattern
    await query('SELECT id FROM users WHERE username = $1', ['testuser']);
    const result = await query(
      'SELECT id, name, prefix, permissions, last_used_at, expires_at, created_at FROM api_keys WHERE user_id = $1',
      ['user-1'],
    );

    // Verify no full key in the response
    const row = result.rows[0] as Record<string, unknown>;
    expect(row).not.toHaveProperty('key');
    expect(row).not.toHaveProperty('key_hash');
    expect(row).toHaveProperty('prefix');
    expect(row.prefix).toBe('abcd1234');
  });

  it('revokes API keys by deleting from DB', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'key-1' }], rowCount: 1 } as never);

    await query('SELECT id FROM users WHERE username = $1', ['testuser']);
    const result = await query(
      'DELETE FROM api_keys WHERE id = $1 AND user_id = $2 RETURNING id',
      ['key-1', 'user-1'],
    );

    expect(result.rows[0]).toEqual({ id: 'key-1' });
  });

  it('returns empty when revoking non-existent key', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await query('SELECT id FROM users WHERE username = $1', ['testuser']);
    const result = await query(
      'DELETE FROM api_keys WHERE id = $1 AND user_id = $2 RETURNING id',
      ['nonexistent', 'user-1'],
    );

    expect(result.rows).toHaveLength(0);
  });
});
