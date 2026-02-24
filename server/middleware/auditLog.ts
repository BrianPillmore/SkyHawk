import { type Request, type Response, type NextFunction } from 'express';
import { query } from '../db/index.js';

/**
 * Map HTTP method + route pattern to a human-readable action string.
 */
function deriveAction(method: string, path: string): string {
  // Strip /api/ prefix and query params
  const clean = path.replace(/^\/api\//, '').split('?')[0];
  // Extract the resource type from the first path segment
  const segments = clean.split('/').filter(Boolean);
  const resource = segments[0] || 'unknown';

  // Map to a dot-notation action
  const methodMap: Record<string, string> = {
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };

  const verb = methodMap[method] || method.toLowerCase();
  return `${resource}.${verb}`;
}

/**
 * Extract a resource ID from the request path.
 * Looks for UUID-like segments in the path.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractResourceId(path: string): string | null {
  const segments = path.split('/').filter(Boolean);
  // Find the last UUID segment
  for (let i = segments.length - 1; i >= 0; i--) {
    if (UUID_RE.test(segments[i])) {
      return segments[i];
    }
  }
  return null;
}

/**
 * Extract the resource type from the request path.
 */
function extractResourceType(path: string): string {
  const clean = path.replace(/^\/api\//, '').split('?')[0];
  const segments = clean.split('/').filter(Boolean);
  // Use the first non-UUID segment (or first segment)
  for (const seg of segments) {
    if (!UUID_RE.test(seg)) {
      return seg;
    }
  }
  return segments[0] || 'unknown';
}

/**
 * Audit logging middleware.
 * Logs all mutating requests (POST, PUT, PATCH, DELETE) to the audit_log table.
 * Runs AFTER the route handler completes (uses res.on('finish')).
 * Fire-and-forget: never fails the request if logging fails.
 */
export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  // Capture values before the handler modifies anything
  const method = req.method;
  const path = req.originalUrl || req.url;
  const ip = req.ip || req.socket.remoteAddress || null;

  res.on('finish', () => {
    // Only log successful mutations (2xx/3xx status codes)
    if (res.statusCode >= 400) {
      return;
    }

    try {
      const user = (req as Request & { user?: { username?: string; userId?: string } }).user;
      const userId = user?.userId || null;
      const action = deriveAction(method, path);
      const resourceType = extractResourceType(path);
      const resourceId = extractResourceId(path);

      // Build details JSON
      const details = JSON.stringify({
        method,
        path,
        statusCode: res.statusCode,
        // Include body keys but not full values for security
        bodyKeys: req.body ? Object.keys(req.body) : [],
      });

      // Fire and forget — do not await, do not let errors propagate
      query(
        `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, action, resourceType, resourceId, details, ip],
      ).catch((err) => {
        console.warn('Audit log write failed (non-fatal):', err);
      });
    } catch (err) {
      console.warn('Audit log capture failed (non-fatal):', err);
    }
  });

  next();
}
