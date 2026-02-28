import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db/index.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FileUser {
  username: string;
  passwordHash: string;
}

interface UsersFile {
  users: FileUser[];
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return secret;
}

/** Try loading users from flat file (legacy fallback) */
function loadUsersFromFile(): UsersFile | null {
  try {
    const filePath = join(__dirname, '..', 'data', 'users.json');
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as UsersFile;
  } catch {
    return null;
  }
}

/** Check if PostgreSQL is available */
async function isDbAvailable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /api/auth/register
 * Body: { username, password, email? }
 * Creates a new user account. Requires DATABASE_URL.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const dbReady = await isDbAvailable();
    if (!dbReady) {
      res.status(503).json({ error: 'Registration requires database. Contact administrator.' });
      return;
    }

    // Check for existing user
    const existing = await query(
      'SELECT id FROM users WHERE username = $1',
      [username],
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3) RETURNING id, username, role, created_at`,
      [username, email || null, passwordHash],
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { username: user.username, userId: user.id, role: user.role || 'user' },
      getJwtSecret(),
      { expiresIn: '24h' },
    );

    res.status(201).json({ token, username: user.username, userId: user.id, reportCredits: 0 });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, username, userId? }
 * Tries PostgreSQL first, falls back to users.json if DB unavailable.
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const dbReady = await isDbAvailable();

    if (dbReady) {
      // Try database authentication
      const result = await query<{ id: string; username: string; password_hash: string; report_credits: number; role: string }>(
        'SELECT id, username, password_hash, COALESCE(report_credits, 0) AS report_credits, COALESCE(role, \'user\') AS role FROM users WHERE username = $1',
        [username],
      );

      if (result.rows.length > 0) {
        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
          res.status(401).json({ error: 'Invalid username or password' });
          return;
        }

        const token = jwt.sign(
          { username: user.username, userId: user.id, role: user.role },
          getJwtSecret(),
          { expiresIn: '24h' },
        );

        res.json({ token, username: user.username, userId: user.id, reportCredits: user.report_credits });
        return;
      }
    }

    // Fallback to flat-file users.json
    const fileUsers = loadUsersFromFile();
    if (!fileUsers) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const fileUser = fileUsers.users.find((u) => u.username === username);
    if (!fileUser) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const valid = await bcrypt.compare(password, fileUser.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // If DB is available, migrate this user on-the-fly
    let userId: string | undefined;
    if (dbReady) {
      try {
        const migrated = await query(
          `INSERT INTO users (username, password_hash)
           VALUES ($1, $2)
           ON CONFLICT (username) DO UPDATE SET password_hash = $2
           RETURNING id`,
          [fileUser.username, fileUser.passwordHash],
        );
        userId = migrated.rows[0].id;
      } catch (migErr) {
        console.warn('Failed to migrate user to DB:', migErr);
      }
    }

    const token = jwt.sign(
      { username: fileUser.username, role: 'user', ...(userId ? { userId } : {}) },
      getJwtSecret(),
      { expiresIn: '24h' },
    );

    res.json({ token, username: fileUser.username, ...(userId ? { userId } : {}) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Client-side token removal; server no-op.
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Validates the token and returns current user info.
 */
router.get('/me', async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, getJwtSecret()) as {
      username: string;
      userId?: string;
    };

    // Try to fetch credits from DB
    let reportCredits = 0;
    if (payload.userId) {
      try {
        const result = await query<{ report_credits: number }>(
          'SELECT COALESCE(report_credits, 0) AS report_credits FROM users WHERE id = $1',
          [payload.userId],
        );
        if (result.rows.length > 0) {
          reportCredits = result.rows[0].report_credits;
        }
      } catch {
        // DB may not be available — return 0 credits
      }
    }

    res.json({ username: payload.username, userId: payload.userId, reportCredits });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

/**
 * POST /api/auth/use-credit
 * Deducts 1 report credit from the authenticated user.
 * Returns { reportCredits } with the new balance.
 */
router.post('/use-credit', async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, getJwtSecret()) as {
      username: string;
      userId?: string;
    };

    if (!payload.userId) {
      res.status(400).json({ error: 'User account not linked to database' });
      return;
    }

    const dbReady = await isDbAvailable();
    if (!dbReady) {
      res.status(503).json({ error: 'Database unavailable' });
      return;
    }

    // Check current balance
    const current = await query<{ report_credits: number }>(
      'SELECT COALESCE(report_credits, 0) AS report_credits FROM users WHERE id = $1',
      [payload.userId],
    );

    if (current.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (current.rows[0].report_credits <= 0) {
      res.status(402).json({ error: 'No report credits remaining', reportCredits: 0 });
      return;
    }

    const result = await query<{ report_credits: number }>(
      'UPDATE users SET report_credits = report_credits - 1 WHERE id = $1 AND report_credits > 0 RETURNING report_credits',
      [payload.userId],
    );

    if (result.rows.length === 0) {
      res.status(402).json({ error: 'No report credits remaining', reportCredits: 0 });
      return;
    }

    res.json({ reportCredits: result.rows[0].report_credits });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export { router as authRouter };
