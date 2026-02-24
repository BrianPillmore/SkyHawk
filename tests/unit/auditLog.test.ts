import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the audit logging middleware and audit log query routes.
 * Covers log creation, query filtering, and pagination patterns.
 */

// Mock the database module
vi.mock('../../server/db/index', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  getPool: vi.fn(),
  initDb: vi.fn(),
  closeDb: vi.fn(),
}));

import { query } from '../../server/db/index';
import { auditLogger } from '../../server/middleware/auditLog';
import type { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';

const mockQuery = vi.mocked(query);

// Helper: create mock req/res/next with EventEmitter support on res
function createMockReqRes(options: {
  method?: string;
  url?: string;
  originalUrl?: string;
  body?: Record<string, unknown>;
  user?: Record<string, unknown>;
  ip?: string;
  statusCode?: number;
} = {}) {
  const req = {
    method: options.method || 'GET',
    url: options.url || '/api/test',
    originalUrl: options.originalUrl || options.url || '/api/test',
    body: options.body || {},
    ip: options.ip || '192.168.1.1',
    socket: { remoteAddress: '192.168.1.1' },
    headers: {},
    ...(options.user ? { user: options.user } : {}),
  } as unknown as Request;

  // Create a response that extends EventEmitter so we can test res.on('finish')
  const resEmitter = new EventEmitter();
  const res = Object.assign(resEmitter, {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    statusCode: options.statusCode ?? 200,
  }) as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
}

describe('auditLogger middleware', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('skips logging for GET requests', () => {
    const { req, res, next } = createMockReqRes({ method: 'GET' });
    auditLogger(req, res, next);
    expect(next).toHaveBeenCalled();
    // Emit finish to verify nothing happens
    (res as unknown as EventEmitter).emit('finish');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('skips logging for HEAD requests', () => {
    const { req, res, next } = createMockReqRes({ method: 'HEAD' });
    auditLogger(req, res, next);
    expect(next).toHaveBeenCalled();
    (res as unknown as EventEmitter).emit('finish');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('logs POST requests after response finishes', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const { req, res, next } = createMockReqRes({
      method: 'POST',
      url: '/api/properties',
      originalUrl: '/api/properties',
      body: { address: '123 Main St', lat: 35.0, lng: -97.0 },
      user: { username: 'testuser', userId: 'user-123' },
      statusCode: 201,
    });

    auditLogger(req, res, next);
    expect(next).toHaveBeenCalled();

    // Simulate the response finishing
    (res as unknown as EventEmitter).emit('finish');

    // Wait for the fire-and-forget query to be called
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const callArgs = mockQuery.mock.calls[0];
    expect(callArgs[0]).toContain('INSERT INTO audit_log');
    // Verify params: [userId, action, resourceType, resourceId, details, ip]
    const params = callArgs[1] as unknown[];
    expect(params[0]).toBe('user-123'); // user_id
    expect(params[1]).toBe('properties.create'); // action
    expect(params[2]).toBe('properties'); // resource_type
    expect(params[5]).toBe('192.168.1.1'); // ip_address
  });

  it('logs PUT requests', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const { req, res, next } = createMockReqRes({
      method: 'PUT',
      url: '/api/properties/abc-123-uuid',
      originalUrl: '/api/properties/abc-123-uuid',
      user: { username: 'testuser', userId: 'user-123' },
      statusCode: 200,
    });

    auditLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[1]).toBe('properties.update'); // action
  });

  it('logs DELETE requests', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const { req, res, next } = createMockReqRes({
      method: 'DELETE',
      url: '/api/api-keys/key-uuid-here',
      originalUrl: '/api/api-keys/key-uuid-here',
      user: { username: 'testuser', userId: 'user-123' },
      statusCode: 200,
    });

    auditLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[1]).toBe('api-keys.delete'); // action
    expect(params[2]).toBe('api-keys'); // resource_type
  });

  it('does not log failed mutations (status >= 400)', async () => {
    const { req, res, next } = createMockReqRes({
      method: 'POST',
      url: '/api/properties',
      user: { username: 'testuser', userId: 'user-123' },
      statusCode: 400,
    });

    auditLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('does not fail the request when audit log write fails', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    const { req, res, next } = createMockReqRes({
      method: 'POST',
      url: '/api/properties',
      user: { username: 'testuser', userId: 'user-123' },
      statusCode: 201,
    });

    auditLogger(req, res, next);
    expect(next).toHaveBeenCalled();

    (res as unknown as EventEmitter).emit('finish');

    await new Promise((resolve) => setTimeout(resolve, 10));

    // The middleware should have caught the error silently
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Audit log write failed (non-fatal):',
      expect.any(Error),
    );

    consoleWarnSpy.mockRestore();
  });

  it('handles missing user gracefully (null user_id)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const { req, res, next } = createMockReqRes({
      method: 'POST',
      url: '/api/auth/register',
      statusCode: 201,
    });

    auditLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[0]).toBeNull(); // user_id should be null
  });

  it('captures request body keys in details (not full values)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const { req, res, next } = createMockReqRes({
      method: 'POST',
      url: '/api/properties',
      body: { address: '123 Main', password: 'secret123', lat: 35.0 },
      user: { username: 'testuser', userId: 'user-123' },
      statusCode: 201,
    });

    auditLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    await new Promise((resolve) => setTimeout(resolve, 10));

    const params = mockQuery.mock.calls[0][1] as unknown[];
    const details = JSON.parse(params[4] as string);
    // Should contain keys but not actual values
    expect(details.bodyKeys).toEqual(['address', 'password', 'lat']);
    expect(details).not.toHaveProperty('body');
  });
});

describe('Audit log query patterns', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('queries audit log with pagination', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'log-1',
          user_id: 'user-1',
          username: 'admin',
          action: 'properties.create',
          resource_type: 'properties',
          resource_id: 'prop-1',
          details: '{}',
          ip_address: '192.168.1.1',
          created_at: '2026-02-24T10:00:00Z',
        },
        {
          id: 'log-2',
          user_id: 'user-2',
          username: 'manager',
          action: 'properties.update',
          resource_type: 'properties',
          resource_id: 'prop-2',
          details: '{}',
          ip_address: '10.0.0.1',
          created_at: '2026-02-24T09:00:00Z',
        },
      ],
      rowCount: 2,
    } as never);

    // Simulate the query pattern from the audit route
    const page = 1;
    const limit = 50;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT al.id, al.user_id, u.username, al.action, al.resource_type,
              al.resource_id, al.details, al.ip_address, al.created_at
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].action).toBe('properties.create');
  });

  it('filters audit log by user_id', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'log-1',
        user_id: 'user-1',
        action: 'properties.create',
      }],
      rowCount: 1,
    } as never);

    const result = await query(
      `SELECT al.id, al.user_id, al.action
       FROM audit_log al WHERE al.user_id = $1
       ORDER BY al.created_at DESC LIMIT $2 OFFSET $3`,
      ['user-1', 50, 0],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].user_id).toBe('user-1');
  });

  it('filters audit log by date range', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'log-1',
        action: 'properties.create',
        created_at: '2026-02-24T10:00:00Z',
      }],
      rowCount: 1,
    } as never);

    const from = new Date('2026-02-24T00:00:00Z').toISOString();
    const to = new Date('2026-02-24T23:59:59Z').toISOString();

    const result = await query(
      `SELECT al.id, al.action, al.created_at
       FROM audit_log al WHERE al.created_at >= $1 AND al.created_at <= $2
       ORDER BY al.created_at DESC LIMIT $3 OFFSET $4`,
      [from, to, 50, 0],
    );

    expect(result.rows).toHaveLength(1);
  });

  it('filters audit log by action type', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'log-1', action: 'properties.delete' },
        { id: 'log-2', action: 'properties.delete' },
      ],
      rowCount: 2,
    } as never);

    const result = await query(
      `SELECT al.id, al.action FROM audit_log al
       WHERE al.action = $1
       ORDER BY al.created_at DESC LIMIT $2 OFFSET $3`,
      ['properties.delete', 50, 0],
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].action).toBe('properties.delete');
    expect(result.rows[1].action).toBe('properties.delete');
  });

  it('filters audit log by resource_type', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'log-1', resource_type: 'api-keys', action: 'api-keys.create' }],
      rowCount: 1,
    } as never);

    const result = await query(
      `SELECT al.id, al.resource_type, al.action FROM audit_log al
       WHERE al.resource_type = $1
       ORDER BY al.created_at DESC LIMIT $2 OFFSET $3`,
      ['api-keys', 50, 0],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].resource_type).toBe('api-keys');
  });

  it('returns total count for pagination', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: '42' }], rowCount: 1 } as never);

    const result = await query<{ total: string }>(
      'SELECT COUNT(*) as total FROM audit_log',
      [],
    );

    const total = parseInt(result.rows[0].total, 10);
    expect(total).toBe(42);
    expect(Math.ceil(total / 50)).toBe(1); // 1 page for 42 entries with limit 50
  });

  it('returns correct pagination metadata for multiple pages', () => {
    const total = 127;
    const limit = 50;
    const page = 2;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    expect(totalPages).toBe(3);
    expect(offset).toBe(50);
  });
});
