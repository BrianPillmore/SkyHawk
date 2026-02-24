import { Router, type Request, type Response } from 'express';
import { query } from '../db/index.js';
import { requireFields, requireUuidParam } from '../middleware/validate.js';
import type { AuthPayload } from '../middleware/auth.js';

const router = Router();

type AuthRequest = Request & { user: AuthPayload };

/** Extract a single string param from Express params */
function p(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

/** Helper: get user ID from username */
async function getUserId(username: string): Promise<string> {
  const result = await query<{ id: string }>(
    'SELECT id FROM users WHERE username = $1',
    [username],
  );
  if (result.rows.length === 0) {
    throw new Error(`User not found: ${username}`);
  }
  return result.rows[0].id;
}

// ─── LIST PROPERTIES ───────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);

    const result = await query(
      `SELECT id, address, city, state, zip, lat, lng, notes, created_at, updated_at
       FROM properties
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId],
    );

    res.json({ properties: result.rows });
  } catch (err) {
    console.error('List properties error:', err);
    res.status(500).json({ error: 'Failed to list properties' });
  }
});

// ─── GET PROPERTY (with latest measurement summary) ────────────────
router.get('/:id', requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const id = p(req, 'id');

    const propResult = await query(
      `SELECT id, address, city, state, zip, lat, lng, notes, created_at, updated_at
       FROM properties
       WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    if (propResult.rows.length === 0) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const property = propResult.rows[0];

    // Get measurement summaries (not full geometry)
    const measurements = await query(
      `SELECT id, total_area_sqft, total_true_area_sqft, total_squares,
              predominant_pitch, suggested_waste_percent, structure_complexity,
              data_source, created_at, updated_at
       FROM roof_measurements
       WHERE property_id = $1
       ORDER BY created_at DESC`,
      [id],
    );

    // Get damage annotations
    const damage = await query(
      `SELECT id, lat, lng, type, severity, note, created_at
       FROM damage_annotations
       WHERE property_id = $1
       ORDER BY created_at DESC`,
      [id],
    );

    // Get claims
    const claims = await query(
      `SELECT id, claim_number, insured_name, date_of_loss, status, notes, created_at, updated_at
       FROM claims
       WHERE property_id = $1
       ORDER BY created_at DESC`,
      [id],
    );

    // Get snapshots (metadata only)
    const snapshots = await query(
      `SELECT id, label, mime_type, size_bytes, lat, lng, zoom, captured_at
       FROM image_snapshots
       WHERE property_id = $1
       ORDER BY captured_at DESC`,
      [id],
    );

    res.json({
      ...property,
      measurements: measurements.rows,
      damageAnnotations: damage.rows,
      claims: claims.rows,
      snapshots: snapshots.rows,
    });
  } catch (err) {
    console.error('Get property error:', err);
    res.status(500).json({ error: 'Failed to get property' });
  }
});

// ─── CREATE PROPERTY ───────────────────────────────────────────────
router.post(
  '/',
  requireFields('address', 'lat', 'lng'),
  async (req: Request, res: Response) => {
    try {
      const { username } = (req as AuthRequest).user;
      const userId = await getUserId(username);
      const { address, city, state, zip, lat, lng, notes } = req.body;

      const result = await query(
        `INSERT INTO properties (user_id, address, city, state, zip, lat, lng, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, address, city, state, zip, lat, lng, notes, created_at, updated_at`,
        [userId, address, city || '', state || '', zip || '', lat, lng, notes || ''],
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Create property error:', err);
      res.status(500).json({ error: 'Failed to create property' });
    }
  },
);

// ─── UPDATE PROPERTY ───────────────────────────────────────────────
router.put('/:id', requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const id = p(req, 'id');
    const { address, city, state, zip, lat, lng, notes } = req.body;

    const result = await query(
      `UPDATE properties
       SET address = COALESCE($3, address),
           city = COALESCE($4, city),
           state = COALESCE($5, state),
           zip = COALESCE($6, zip),
           lat = COALESCE($7, lat),
           lng = COALESCE($8, lng),
           notes = COALESCE($9, notes),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, address, city, state, zip, lat, lng, notes, created_at, updated_at`,
      [id, userId, address, city, state, zip, lat, lng, notes],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update property error:', err);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

// ─── DELETE PROPERTY ───────────────────────────────────────────────
router.delete('/:id', requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const id = p(req, 'id');

    const result = await query(
      'DELETE FROM properties WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    res.json({ deleted: true, id });
  } catch (err) {
    console.error('Delete property error:', err);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

// ─── DAMAGE ANNOTATIONS ───────────────────────────────────────────
router.post(
  '/:id/damage-annotations',
  requireUuidParam('id'),
  requireFields('lat', 'lng', 'type', 'severity'),
  async (req: Request, res: Response) => {
    try {
      const { username } = (req as AuthRequest).user;
      const userId = await getUserId(username);
      const propertyId = p(req, 'id');

      // Verify ownership
      const prop = await query(
        'SELECT id FROM properties WHERE id = $1 AND user_id = $2',
        [propertyId, userId],
      );
      if (prop.rows.length === 0) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const { lat, lng, type, severity, note } = req.body;
      const result = await query(
        `INSERT INTO damage_annotations (property_id, lat, lng, type, severity, note)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, lat, lng, type, severity, note, created_at`,
        [propertyId, lat, lng, type, severity, note || ''],
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Add damage annotation error:', err);
      res.status(500).json({ error: 'Failed to add damage annotation' });
    }
  },
);

router.delete(
  '/:id/damage-annotations/:did',
  requireUuidParam('id', 'did'),
  async (req: Request, res: Response) => {
    try {
      const { username } = (req as AuthRequest).user;
      const userId = await getUserId(username);
      const propertyId = p(req, 'id');
      const did = p(req, 'did');

      // Verify ownership
      const prop = await query(
        'SELECT id FROM properties WHERE id = $1 AND user_id = $2',
        [propertyId, userId],
      );
      if (prop.rows.length === 0) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const result = await query(
        'DELETE FROM damage_annotations WHERE id = $1 AND property_id = $2 RETURNING id',
        [did, propertyId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Annotation not found' });
        return;
      }

      res.json({ deleted: true, id: did });
    } catch (err) {
      console.error('Delete damage annotation error:', err);
      res.status(500).json({ error: 'Failed to delete damage annotation' });
    }
  },
);

export { router as propertiesRouter };
