import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
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

/** Supported webhook event types */
const VALID_EVENTS = [
  'property.created',
  'property.updated',
  'measurement.completed',
  'report.generated',
  'claim.updated',
] as const;

/** Generate HMAC signature for webhook payload */
function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/** Generate a random webhook secret */
function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Fire a webhook to all matching subscribers.
 * Retries up to 3 times with exponential backoff on failure.
 */
export async function fireWebhook(
  userId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    // Find all active webhooks for this user that subscribe to this event
    const result = await query<{
      id: string;
      url: string;
      secret: string;
      failure_count: number;
    }>(
      `SELECT id, url, secret, failure_count
       FROM webhooks
       WHERE user_id = $1 AND active = true AND events @> $2::jsonb`,
      [userId, JSON.stringify([event])],
    );

    for (const webhook of result.rows) {
      deliverWebhook(webhook.id, webhook.url, webhook.secret, event, payload).catch(
        (err) => console.error(`Webhook delivery failed for ${webhook.id}:`, err),
      );
    }
  } catch (err) {
    console.error('fireWebhook error:', err);
  }
}

/**
 * Deliver a single webhook with retry logic.
 * Max 3 retries with exponential backoff (1s, 2s, 4s).
 */
async function deliverWebhook(
  webhookId: string,
  url: string,
  secret: string,
  event: string,
  payload: Record<string, unknown>,
  attempt = 1,
): Promise<void> {
  const maxRetries = 3;
  const body = JSON.stringify({
    event,
    payload,
    timestamp: new Date().toISOString(),
    webhookId,
  });

  const signature = signPayload(body, secret);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SkyHawk-Signature': signature,
        'X-SkyHawk-Event': event,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      // Success: update last triggered, reset failure count
      await query(
        `UPDATE webhooks
         SET last_triggered_at = NOW(), failure_count = 0
         WHERE id = $1`,
        [webhookId],
      );
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (err) {
    console.error(`Webhook delivery attempt ${attempt} failed for ${webhookId}:`, err);

    // Increment failure count
    await query(
      `UPDATE webhooks
       SET failure_count = failure_count + 1
       WHERE id = $1`,
      [webhookId],
    );

    // Retry with exponential backoff
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, delay));
      return deliverWebhook(webhookId, url, secret, event, payload, attempt + 1);
    }

    // After max retries, deactivate the webhook if failure count is too high
    const result = await query<{ failure_count: number }>(
      'SELECT failure_count FROM webhooks WHERE id = $1',
      [webhookId],
    );
    if (result.rows.length > 0 && result.rows[0].failure_count >= 10) {
      await query(
        'UPDATE webhooks SET active = false WHERE id = $1',
        [webhookId],
      );
      console.warn(`Webhook ${webhookId} deactivated after 10 consecutive failures`);
    }
  }
}

// ─── REGISTER WEBHOOK ───────────────────────────────────────────────
router.post(
  '/',
  requireFields('url', 'events'),
  async (req: Request, res: Response) => {
    try {
      const { username } = (req as AuthRequest).user;
      const userId = await getUserId(username);
      const { url, events, organizationId } = req.body;

      // Validate URL
      try {
        new URL(url);
      } catch {
        res.status(400).json({ error: 'Invalid webhook URL' });
        return;
      }

      // Validate events
      if (!Array.isArray(events) || events.length === 0) {
        res.status(400).json({ error: 'At least one event is required' });
        return;
      }

      const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e as typeof VALID_EVENTS[number]));
      if (invalidEvents.length > 0) {
        res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}` });
        return;
      }

      const secret = generateSecret();

      const result = await query(
        `INSERT INTO webhooks (user_id, organization_id, url, secret, events)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, url, events, active, failure_count, created_at`,
        [userId, organizationId || null, url, secret, JSON.stringify(events)],
      );

      // Return the secret only on creation
      res.status(201).json({
        ...result.rows[0],
        secret,
      });
    } catch (err) {
      console.error('Register webhook error:', err);
      res.status(500).json({ error: 'Failed to register webhook' });
    }
  },
);

// ─── LIST WEBHOOKS ──────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);

    const result = await query(
      `SELECT id, url, events, active, last_triggered_at, failure_count, created_at
       FROM webhooks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    res.json({ webhooks: result.rows });
  } catch (err) {
    console.error('List webhooks error:', err);
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

// ─── UPDATE WEBHOOK ─────────────────────────────────────────────────
router.put('/:id', requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const webhookId = p(req, 'id');
    const { url, events, active } = req.body;

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        res.status(400).json({ error: 'Invalid webhook URL' });
        return;
      }
    }

    // Validate events if provided
    if (events) {
      if (!Array.isArray(events) || events.length === 0) {
        res.status(400).json({ error: 'At least one event is required' });
        return;
      }
      const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e as typeof VALID_EVENTS[number]));
      if (invalidEvents.length > 0) {
        res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}` });
        return;
      }
    }

    const result = await query(
      `UPDATE webhooks
       SET url = COALESCE($3, url),
           events = COALESCE($4, events),
           active = COALESCE($5, active)
       WHERE id = $1 AND user_id = $2
       RETURNING id, url, events, active, last_triggered_at, failure_count, created_at`,
      [webhookId, userId, url || null, events ? JSON.stringify(events) : null, active ?? null],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update webhook error:', err);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// ─── DELETE WEBHOOK ─────────────────────────────────────────────────
router.delete('/:id', requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const webhookId = p(req, 'id');

    const result = await query(
      'DELETE FROM webhooks WHERE id = $1 AND user_id = $2 RETURNING id',
      [webhookId, userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    res.json({ deleted: true, id: webhookId });
  } catch (err) {
    console.error('Delete webhook error:', err);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// ─── TEST WEBHOOK ───────────────────────────────────────────────────
router.post('/:id/test', requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const webhookId = p(req, 'id');

    const result = await query<{
      id: string;
      url: string;
      secret: string;
    }>(
      'SELECT id, url, secret FROM webhooks WHERE id = $1 AND user_id = $2',
      [webhookId, userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    const webhook = result.rows[0];

    // Send a test event
    const testPayload = {
      event: 'test',
      payload: {
        message: 'This is a test webhook from SkyHawk',
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      webhookId: webhook.id,
    };

    const body = JSON.stringify(testPayload);
    const signature = signPayload(body, webhook.secret);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SkyHawk-Signature': signature,
          'X-SkyHawk-Event': 'test',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        res.json({ success: true, statusCode: response.status });
      } else {
        res.json({
          success: false,
          statusCode: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (fetchErr) {
      res.json({
        success: false,
        error: fetchErr instanceof Error ? fetchErr.message : 'Failed to deliver test webhook',
      });
    }
  } catch (err) {
    console.error('Test webhook error:', err);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

export { router as webhooksRouter };
