import { Router, type Request, type Response } from 'express';
import { query } from '../db/index.js';
import type { AuthPayload } from '../middleware/auth.js';

const router = Router();

type AuthRequest = Request & { user: AuthPayload };

interface BatchSubmitBody {
  addresses: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
  }[];
  name?: string;
}

// ─── SUBMIT BATCH JOB ────────────────────────────────────────────
// POST /api/batch
// Creates properties in bulk from a list of addresses.
router.post('/', async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const { addresses, name } = req.body as BatchSubmitBody;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'addresses array is required' });
    }

    if (addresses.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 addresses per batch' });
    }

    // Get user ID
    const userResult = await query<{ id: string }>(
      'SELECT id FROM users WHERE username = $1',
      [username],
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = userResult.rows[0].id;

    // Insert properties in bulk
    const results: { id: string; address: string; status: string }[] = [];
    const errors: { address: string; error: string }[] = [];

    for (const addr of addresses) {
      try {
        if (!addr.address || addr.address.trim().length === 0) {
          errors.push({ address: addr.address || '(empty)', error: 'Address is required' });
          continue;
        }

        const result = await query<{ id: string }>(
          `INSERT INTO properties (id, user_id, address, city, state, zip, lat, lng, notes, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, '', NOW(), NOW())
           RETURNING id`,
          [
            userId,
            addr.address.trim(),
            addr.city?.trim() || '',
            addr.state?.trim() || '',
            addr.zip?.trim() || '',
            addr.lat || 0,
            addr.lng || 0,
          ],
        );

        results.push({
          id: result.rows[0].id,
          address: addr.address,
          status: 'created',
        });
      } catch (err) {
        errors.push({
          address: addr.address,
          error: err instanceof Error ? err.message : 'Insert failed',
        });
      }
    }

    res.json({
      batchName: name || `Batch ${new Date().toISOString()}`,
      total: addresses.length,
      created: results.length,
      errors: errors.length,
      results,
      errorDetails: errors,
    });
  } catch (err) {
    console.error('Batch submit error:', err);
    res.status(500).json({ error: 'Batch processing failed' });
  }
});

// ─── LIST BATCH HISTORY ──────────────────────────────────────────
// GET /api/batch/history
// Returns properties created via batch, grouped by creation date.
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;

    const userResult = await query<{ id: string }>(
      'SELECT id FROM users WHERE username = $1',
      [username],
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = userResult.rows[0].id;

    // Count properties per day for batch history
    const result = await query(
      `SELECT DATE(created_at) as batch_date, COUNT(*) as property_count
       FROM properties
       WHERE user_id = $1
       GROUP BY DATE(created_at)
       ORDER BY batch_date DESC
       LIMIT 50`,
      [userId],
    );

    res.json({ batches: result.rows });
  } catch (err) {
    console.error('Batch history error:', err);
    res.status(500).json({ error: 'Failed to fetch batch history' });
  }
});

export const batchRouter = router;
