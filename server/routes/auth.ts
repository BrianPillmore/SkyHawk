import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface User {
  username: string;
  passwordHash: string;
}

interface UsersFile {
  users: User[];
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return secret;
}

function loadUsers(): UsersFile {
  const filePath = join(__dirname, '..', 'data', 'users.json');
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as UsersFile;
}

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, username }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const { users } = loadUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const token = jwt.sign({ username: user.username }, getJwtSecret(), {
      expiresIn: '24h',
    });

    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Client-side token removal; this is a no-op on the server.
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Validates the token and returns current user info.
 */
router.get('/me', (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { username: string };
    res.json({ username: payload.username });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export { router as authRouter };
