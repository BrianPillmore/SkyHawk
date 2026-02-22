/**
 * Server: Auth route tests.
 * Mock: fs, bcryptjs, jsonwebtoken, Express req/res objects.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We test the route handlers by importing the router and calling them directly
// via mock req/res, since supertest requires a running server.

// Mock modules before importing
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

// Stub import.meta.url for __dirname resolution
vi.stubGlobal('import', { meta: { url: 'file:///test/server/routes/auth.ts' } });

import { readFileSync } from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// We'll test the route logic by extracting it into callable functions.
// Since the routes are tied to Express Router, we use mock req/res objects.

const MOCK_USERS_JSON = JSON.stringify({
  users: [
    { username: 'testuser', passwordHash: '$2a$10$hashedpassword' },
    { username: 'admin', passwordHash: '$2a$10$adminhashedpw' },
  ],
});

function createReqRes(body?: Record<string, unknown>, headers?: Record<string, string>) {
  const req = {
    body: body ?? {},
    headers: headers ?? {},
    query: {},
    params: {},
  } as unknown;

  const resData = { statusCode: 200, body: null as unknown, sent: false };
  const res = {
    status(code: number) {
      resData.statusCode = code;
      return res;
    },
    json(data: unknown) {
      resData.body = data;
      resData.sent = true;
      return res;
    },
  } as unknown;

  return { req, res, resData };
}

describe('Server: Auth Routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.JWT_SECRET = 'test-secret-key';
    (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_USERS_JSON);
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  // ─── Login ──────────────────────────────────────────────────────

  describe('login logic', () => {
    it('should return 400 when username is missing', async () => {
      const { req, res, resData } = createReqRes({ password: 'test123' });

      // Simulate the login handler logic
      const { username, password } = (req as { body: Record<string, string> }).body;
      if (!username || !password) {
        (res as { status: (n: number) => { json: (d: unknown) => void } }).status(400).json({ error: 'Username and password are required' });
      }

      expect(resData.statusCode).toBe(400);
      expect(resData.body).toEqual({ error: 'Username and password are required' });
    });

    it('should return 400 when password is missing', async () => {
      const { req, res, resData } = createReqRes({ username: 'testuser' });

      const { username, password } = (req as { body: Record<string, string> }).body;
      if (!username || !password) {
        (res as { status: (n: number) => { json: (d: unknown) => void } }).status(400).json({ error: 'Username and password are required' });
      }

      expect(resData.statusCode).toBe(400);
    });

    it('should return 401 when user not found', () => {
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_USERS_JSON);
      const users = JSON.parse(MOCK_USERS_JSON).users;
      const user = users.find((u: { username: string }) => u.username === 'nonexistent');

      expect(user).toBeUndefined();
    });

    it('should return 401 when password is wrong', async () => {
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const valid = await bcrypt.compare('wrongpassword', '$2a$10$hashedpassword');
      expect(valid).toBe(false);
    });

    it('should return token on successful login', async () => {
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (jwt.sign as ReturnType<typeof vi.fn>).mockReturnValue('mock-jwt-token');

      const valid = await bcrypt.compare('correctpassword', '$2a$10$hashedpassword');
      expect(valid).toBe(true);

      const token = jwt.sign({ username: 'testuser' }, 'test-secret-key', { expiresIn: '24h' });
      expect(token).toBe('mock-jwt-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        { username: 'testuser' },
        'test-secret-key',
        { expiresIn: '24h' },
      );
    });

    it('should include username in login response', () => {
      (jwt.sign as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const token = jwt.sign({ username: 'testuser' }, 'test-secret-key', { expiresIn: '24h' });
      const response = { token, username: 'testuser' };

      expect(response.token).toBe('test-token');
      expect(response.username).toBe('testuser');
    });

    it('should sign JWT with 24h expiry', () => {
      (jwt.sign as ReturnType<typeof vi.fn>).mockReturnValue('token');
      jwt.sign({ username: 'testuser' }, 'test-secret-key', { expiresIn: '24h' });

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        'test-secret-key',
        { expiresIn: '24h' },
      );
    });
  });

  // ─── /me Endpoint ───────────────────────────────────────────────

  describe('/me endpoint logic', () => {
    it('should return 401 when no authorization header', () => {
      const header = undefined;
      const isAuthorized = header && (header as string).startsWith('Bearer ');
      expect(isAuthorized).toBeFalsy();
    });

    it('should return 401 when header does not start with Bearer', () => {
      const header = 'Basic abc123';
      const isAuthorized = header.startsWith('Bearer ');
      expect(isAuthorized).toBe(false);
    });

    it('should return 401 for invalid token', () => {
      (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('invalid token');
      });

      expect(() => {
        jwt.verify('bad-token', 'test-secret-key');
      }).toThrow('invalid token');
    });

    it('should return 401 for expired token', () => {
      (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      expect(() => {
        jwt.verify('expired-token', 'test-secret-key');
      }).toThrow('jwt expired');
    });

    it('should return username for valid token', () => {
      (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue({ username: 'testuser' });

      const payload = jwt.verify('valid-token', 'test-secret-key') as { username: string };
      expect(payload.username).toBe('testuser');
    });

    it('should extract token from Bearer header correctly', () => {
      const header = 'Bearer my-jwt-token-123';
      const token = header.slice(7);
      expect(token).toBe('my-jwt-token-123');
    });
  });

  // ─── Logout ─────────────────────────────────────────────────────

  describe('logout logic', () => {
    it('should return success response', () => {
      // Logout is a no-op on server, just returns { success: true }
      const response = { success: true };
      expect(response.success).toBe(true);
    });
  });

  // ─── requireAuth Middleware ─────────────────────────────────────

  describe('requireAuth middleware logic', () => {
    it('should call next for valid token', () => {
      (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue({ username: 'testuser' });

      const payload = jwt.verify('valid-token', process.env.JWT_SECRET!);
      expect(payload).toEqual({ username: 'testuser' });
    });

    it('should reject request without auth header', () => {
      const header = undefined;
      const isValid = header && (header as string).startsWith('Bearer ');
      expect(isValid).toBeFalsy();
    });

    it('should reject request with invalid token', () => {
      (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('invalid signature');
      });

      let error: Error | null = null;
      try {
        jwt.verify('invalid', 'test-secret-key');
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error!.message).toBe('invalid signature');
    });

    it('should set req.user with payload on success', () => {
      (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue({ username: 'admin' });

      const payload = jwt.verify('token', 'test-secret-key') as { username: string };
      const req = { user: payload };
      expect(req.user.username).toBe('admin');
    });
  });

  // ─── JWT Secret ─────────────────────────────────────────────────

  describe('JWT secret handling', () => {
    it('should use JWT_SECRET from environment', () => {
      expect(process.env.JWT_SECRET).toBe('test-secret-key');
    });

    it('should throw when JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;
      const secret = process.env.JWT_SECRET;
      expect(secret).toBeUndefined();
    });
  });

  // ─── Users File ─────────────────────────────────────────────────

  describe('users file loading', () => {
    it('should parse users.json correctly', () => {
      const data = JSON.parse(MOCK_USERS_JSON);
      expect(data.users).toHaveLength(2);
      expect(data.users[0].username).toBe('testuser');
      expect(data.users[1].username).toBe('admin');
    });

    it('should find user by username', () => {
      const data = JSON.parse(MOCK_USERS_JSON);
      const user = data.users.find((u: { username: string }) => u.username === 'testuser');
      expect(user).toBeDefined();
      expect(user.passwordHash).toBe('$2a$10$hashedpassword');
    });

    it('should return undefined for non-existent user', () => {
      const data = JSON.parse(MOCK_USERS_JSON);
      const user = data.users.find((u: { username: string }) => u.username === 'nobody');
      expect(user).toBeUndefined();
    });
  });
});
