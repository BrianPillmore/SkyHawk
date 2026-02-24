import { type Request, type Response, type NextFunction } from 'express';

/**
 * Validates that required fields exist in the request body.
 * Returns 400 with a descriptive error if any are missing.
 */
export function requireFields(...fields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = fields.filter((f) => {
      const value = req.body[f];
      return value === undefined || value === null || value === '';
    });
    if (missing.length > 0) {
      res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`,
      });
      return;
    }
    next();
  };
}

/**
 * Validates that a route param is a valid UUID v4.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuidParam(...params: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const param of params) {
      const raw = req.params[param];
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (!value || !UUID_RE.test(value)) {
        res.status(400).json({ error: `Invalid ${param}: must be a valid UUID` });
        return;
      }
    }
    next();
  };
}

/**
 * Validates numeric query params, coercing to number.
 * Attaches parsed values to req.query.
 */
export function parseNumericQuery(...params: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const param of params) {
      const raw = req.query[param];
      if (raw !== undefined) {
        const num = Number(raw);
        if (isNaN(num)) {
          res.status(400).json({ error: `${param} must be a number` });
          return;
        }
        (req.query as Record<string, unknown>)[param] = num as unknown as string;
      }
    }
    next();
  };
}
