import { type Request, type Response, type NextFunction } from 'express';

/**
 * Role hierarchy for SkyHawk RBAC.
 * Higher numeric level = more permissions.
 * Higher roles inherit all permissions of lower roles.
 */
const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  roofer: 1,
  adjuster: 2,
  manager: 3,
  admin: 4,
};

/**
 * Returns the numeric level for a role string.
 * Unknown roles get -1 (no permissions).
 */
export function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY[role] ?? -1;
}

/**
 * Middleware factory that enforces role-based access control.
 * Accepts one or more role names. The user must have at least one of the
 * specified roles OR a higher role in the hierarchy (inheritance).
 *
 * Usage:
 *   router.get('/admin-only', requireRole('admin'), handler);
 *   router.get('/managers-up', requireRole('admin', 'manager'), handler);
 *
 * Expects `req.user` to have been set by prior auth middleware (JWT or API key).
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as Request & { user?: { role?: string } }).user;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = user.role || 'viewer';
    const userLevel = getRoleLevel(userRole);

    // Find the minimum required level among the specified roles.
    // The user passes if their level >= the minimum level of any allowed role.
    const minRequiredLevel = Math.min(
      ...roles.map((r) => getRoleLevel(r)),
    );

    if (userLevel >= minRequiredLevel) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Insufficient permissions',
      required: roles,
      current: userRole,
    });
  };
}
