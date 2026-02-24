import { Router, type Request, type Response } from 'express';
import { query } from '../db/index.js';
import { requireFields, requireUuidParam } from '../middleware/validate.js';
import type { AuthPayload } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

type AuthRequest = Request & { user: AuthPayload };

/** Extract a single string param from Express params */
function p(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

/** Verify user owns the property */
async function verifyPropertyOwnership(
  propertyId: string,
  username: string,
): Promise<boolean> {
  const result = await query(
    `SELECT p.id FROM properties p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $1 AND u.username = $2`,
    [propertyId, username],
  );
  return result.rows.length > 0;
}

// ─── LIST CLAIMS ───────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const propertyId = p(req, 'propertyId');

    if (!(await verifyPropertyOwnership(propertyId, username))) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const result = await query(
      `SELECT id, claim_number, insured_name, date_of_loss, status, notes,
              created_at, updated_at
       FROM claims WHERE property_id = $1 ORDER BY created_at DESC`,
      [propertyId],
    );

    res.json({ claims: result.rows });
  } catch (err) {
    console.error('List claims error:', err);
    res.status(500).json({ error: 'Failed to list claims' });
  }
});

// ─── CREATE CLAIM ──────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const propertyId = p(req, 'propertyId');

    if (!(await verifyPropertyOwnership(propertyId, username))) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const { claimNumber, insuredName, dateOfLoss, notes } = req.body;

    const result = await query(
      `INSERT INTO claims (property_id, claim_number, insured_name, date_of_loss, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, claim_number, insured_name, date_of_loss, status, notes, created_at, updated_at`,
      [propertyId, claimNumber || null, insuredName || null, dateOfLoss || null, notes || ''],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create claim error:', err);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

// ─── UPDATE CLAIM ──────────────────────────────────────────────────
router.put('/:claimId', requireUuidParam('claimId'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const propertyId = p(req, 'propertyId');
    const claimId = p(req, 'claimId');

    if (!(await verifyPropertyOwnership(propertyId, username))) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const { claimNumber, insuredName, dateOfLoss, status, notes } = req.body;

    const result = await query(
      `UPDATE claims
       SET claim_number = COALESCE($3, claim_number),
           insured_name = COALESCE($4, insured_name),
           date_of_loss = COALESCE($5, date_of_loss),
           status = COALESCE($6, status),
           notes = COALESCE($7, notes),
           updated_at = NOW()
       WHERE id = $1 AND property_id = $2
       RETURNING id, claim_number, insured_name, date_of_loss, status, notes, created_at, updated_at`,
      [claimId, propertyId, claimNumber, insuredName, dateOfLoss, status, notes],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update claim error:', err);
    res.status(500).json({ error: 'Failed to update claim' });
  }
});

// ─── DELETE CLAIM ──────────────────────────────────────────────────
router.delete('/:claimId', requireUuidParam('claimId'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const propertyId = p(req, 'propertyId');
    const claimId = p(req, 'claimId');

    if (!(await verifyPropertyOwnership(propertyId, username))) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const result = await query(
      'DELETE FROM claims WHERE id = $1 AND property_id = $2 RETURNING id',
      [claimId, propertyId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }

    res.json({ deleted: true, id: claimId });
  } catch (err) {
    console.error('Delete claim error:', err);
    res.status(500).json({ error: 'Failed to delete claim' });
  }
});

// ─── INSPECTIONS ───────────────────────────────────────────────────

router.post(
  '/:claimId/inspections',
  requireUuidParam('claimId'),
  requireFields('scheduledDate'),
  async (req: Request, res: Response) => {
    try {
      const { username } = (req as AuthRequest).user;
      const propertyId = p(req, 'propertyId');
      const claimId = p(req, 'claimId');

      if (!(await verifyPropertyOwnership(propertyId, username))) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      // Verify claim belongs to property
      const claim = await query(
        'SELECT id FROM claims WHERE id = $1 AND property_id = $2',
        [claimId, propertyId],
      );
      if (claim.rows.length === 0) {
        res.status(404).json({ error: 'Claim not found' });
        return;
      }

      const { adjusterId, scheduledDate, scheduledTime, notes } = req.body;

      const result = await query(
        `INSERT INTO inspections (claim_id, adjuster_id, scheduled_date, scheduled_time, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, claim_id, adjuster_id, scheduled_date, scheduled_time, status, notes,
                   created_at, updated_at`,
        [claimId, adjusterId || null, scheduledDate, scheduledTime || null, notes || ''],
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Schedule inspection error:', err);
      res.status(500).json({ error: 'Failed to schedule inspection' });
    }
  },
);

router.put(
  '/:claimId/inspections/:inspId',
  requireUuidParam('claimId', 'inspId'),
  async (req: Request, res: Response) => {
    try {
      const inspId = p(req, 'inspId');
      const { status, notes, scheduledDate, scheduledTime, adjusterId } = req.body;

      const result = await query(
        `UPDATE inspections
         SET status = COALESCE($2, status),
             notes = COALESCE($3, notes),
             scheduled_date = COALESCE($4, scheduled_date),
             scheduled_time = COALESCE($5, scheduled_time),
             adjuster_id = COALESCE($6, adjuster_id),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, claim_id, adjuster_id, scheduled_date, scheduled_time, status, notes,
                   created_at, updated_at`,
        [inspId, status, notes, scheduledDate, scheduledTime, adjusterId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Inspection not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error('Update inspection error:', err);
      res.status(500).json({ error: 'Failed to update inspection' });
    }
  },
);

export { router as claimsRouter };
