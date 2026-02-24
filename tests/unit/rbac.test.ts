import { describe, it, expect, vi } from 'vitest';
import { requireRole, getRoleLevel } from '../../server/middleware/rbac';
import type { Request, Response, NextFunction } from 'express';

/**
 * Tests for the RBAC (Role-Based Access Control) middleware.
 * Covers role hierarchy, permission inheritance, and 403 responses.
 */

function mockReqResNext(userRole?: string, hasUser = true) {
  const req = {
    params: {},
    body: {},
    headers: {},
    ...(hasUser ? { user: { username: 'testuser', userId: 'user-123', role: userRole || 'viewer' } } : {}),
  } as unknown as Request & { user?: { username: string; userId: string; role: string } };

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
}

describe('getRoleLevel', () => {
  it('returns correct level for each known role', () => {
    expect(getRoleLevel('viewer')).toBe(0);
    expect(getRoleLevel('roofer')).toBe(1);
    expect(getRoleLevel('adjuster')).toBe(2);
    expect(getRoleLevel('manager')).toBe(3);
    expect(getRoleLevel('admin')).toBe(4);
  });

  it('returns -1 for unknown roles', () => {
    expect(getRoleLevel('superuser')).toBe(-1);
    expect(getRoleLevel('')).toBe(-1);
    expect(getRoleLevel('ADMIN')).toBe(-1);
  });
});

describe('requireRole middleware', () => {
  describe('role hierarchy and inheritance', () => {
    it('allows admin to access admin-only routes', () => {
      const { req, res, next } = mockReqResNext('admin');
      requireRole('admin')(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows admin to access manager routes (inheritance)', () => {
      const { req, res, next } = mockReqResNext('admin');
      requireRole('manager')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows admin to access viewer routes (inheritance)', () => {
      const { req, res, next } = mockReqResNext('admin');
      requireRole('viewer')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows manager to access adjuster routes (inheritance)', () => {
      const { req, res, next } = mockReqResNext('manager');
      requireRole('adjuster')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows manager to access manager routes', () => {
      const { req, res, next } = mockReqResNext('manager');
      requireRole('manager')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows adjuster to access roofer routes (inheritance)', () => {
      const { req, res, next } = mockReqResNext('adjuster');
      requireRole('roofer')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows roofer to access viewer routes (inheritance)', () => {
      const { req, res, next } = mockReqResNext('roofer');
      requireRole('viewer')(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('403 rejections for insufficient roles', () => {
    it('denies viewer access to admin routes', () => {
      const { req, res, next } = mockReqResNext('viewer');
      requireRole('admin')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Insufficient permissions',
          required: ['admin'],
          current: 'viewer',
        }),
      );
    });

    it('denies viewer access to manager routes', () => {
      const { req, res, next } = mockReqResNext('viewer');
      requireRole('manager')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('denies roofer access to admin routes', () => {
      const { req, res, next } = mockReqResNext('roofer');
      requireRole('admin')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('denies adjuster access to admin routes', () => {
      const { req, res, next } = mockReqResNext('adjuster');
      requireRole('admin')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('denies manager access to admin-only routes', () => {
      const { req, res, next } = mockReqResNext('manager');
      requireRole('admin')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('multiple roles parameter', () => {
    it('allows manager when requiring admin or manager', () => {
      const { req, res, next } = mockReqResNext('manager');
      requireRole('admin', 'manager')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows admin when requiring admin or manager', () => {
      const { req, res, next } = mockReqResNext('admin');
      requireRole('admin', 'manager')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('denies adjuster when requiring admin or manager', () => {
      const { req, res, next } = mockReqResNext('adjuster');
      requireRole('admin', 'manager')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('allows adjuster when requiring adjuster or roofer', () => {
      const { req, res, next } = mockReqResNext('adjuster');
      requireRole('adjuster', 'roofer')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows manager when requiring adjuster or roofer (inheritance)', () => {
      const { req, res, next } = mockReqResNext('manager');
      requireRole('adjuster', 'roofer')(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('returns 401 when no user is present on req', () => {
      const { req, res, next } = mockReqResNext(undefined, false);
      requireRole('viewer')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Authentication required' }),
      );
    });

    it('defaults to viewer when user has no role property', () => {
      const req = {
        user: { username: 'testuser' },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      // Should pass viewer-level check
      requireRole('viewer')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('denies access for unknown role in user', () => {
      const { req, res, next } = mockReqResNext('superuser');
      // unknown role gets level -1, viewer requires level 0
      requireRole('viewer')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
