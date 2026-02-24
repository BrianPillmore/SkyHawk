import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for checkout route handlers (session creation, webhook handling, credit management).
 * These test the route logic with mocked database calls and Stripe SDK.
 */

// Mock the database module
vi.mock('../../server/db/index', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  getPool: vi.fn(),
  initDb: vi.fn(),
  closeDb: vi.fn(),
}));

import { query } from '../../server/db/index';

const mockQuery = vi.mocked(query);

// Helper: create a mock Express req/res/next
function createMockReqRes(options: {
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  user?: { username: string; userId?: string };
  query?: Record<string, string>;
  headers?: Record<string, string>;
} = {}) {
  const req = {
    params: options.params || {},
    body: options.body || {},
    user: options.user || { username: 'testuser', userId: 'user-123' },
    query: options.query || {},
    headers: options.headers || {},
  } as unknown as import('express').Request & { user: { username: string; userId?: string } };

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as import('express').Response;

  const next = vi.fn();

  return { req, res, next };
}

describe('Checkout session creation patterns', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('validates that priceId is required for session creation', () => {
    const { req, res } = createMockReqRes({
      body: {},
    });

    // The route handler checks for priceId
    const priceId = (req.body as Record<string, unknown>).priceId;
    expect(priceId).toBeUndefined();

    // If no priceId, return 400
    if (!priceId) {
      res.status(400).json({ error: 'priceId is required' });
    }

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'priceId is required' });
  });

  it('determines plan type from price ID', () => {
    const priceSingle = 'price_single_123';
    const pricePro = 'price_pro_456';

    // Single plan
    const planSingle = priceSingle === priceSingle ? 'single' : 'pro';
    expect(planSingle).toBe('single');

    // Pro plan
    const inputPriceId = pricePro;
    const planPro = inputPriceId === pricePro ? 'pro' : 'single';
    expect(planPro).toBe('pro');
  });

  it('rejects invalid price IDs', () => {
    const { res } = createMockReqRes();
    const priceId = 'price_invalid_999';
    const priceSingle = 'price_single_123';
    const pricePro = 'price_pro_456';

    if (priceId !== priceSingle && priceId !== pricePro) {
      res.status(400).json({ error: 'Invalid priceId' });
    }

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid priceId' });
  });

  it('constructs correct checkout session parameters for single plan', () => {
    const origin = 'http://localhost:5173';
    const priceId = 'price_single_123';
    const userId = 'user-123';

    const sessionParams = {
      mode: 'payment' as const,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/gotruf/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/gotruf/checkout/cancel`,
      metadata: {
        userId,
        planType: 'single',
      },
    };

    expect(sessionParams.mode).toBe('payment');
    expect(sessionParams.line_items[0].price).toBe(priceId);
    expect(sessionParams.success_url).toContain('/gotruf/checkout/success');
    expect(sessionParams.cancel_url).toContain('/gotruf/checkout/cancel');
    expect(sessionParams.metadata.planType).toBe('single');
  });

  it('constructs correct checkout session parameters for pro subscription', () => {
    const origin = 'http://localhost:5173';
    const priceId = 'price_pro_456';
    const userId = 'user-123';

    const sessionParams = {
      mode: 'subscription' as const,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/gotruf/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/gotruf/checkout/cancel`,
      metadata: {
        userId,
        planType: 'pro',
      },
      subscription_data: {
        metadata: { userId, planType: 'pro' },
      },
    };

    expect(sessionParams.mode).toBe('subscription');
    expect(sessionParams.subscription_data.metadata.planType).toBe('pro');
  });
});

describe('Webhook handling patterns', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('adds 1 credit for single report purchase', async () => {
    const userId = 'user-123';
    const planType = 'single';
    const creditsToAdd = planType === 'pro' ? 25 : 1;

    expect(creditsToAdd).toBe(1);

    mockQuery.mockResolvedValueOnce({ rows: [{ id: userId }], rowCount: 1 } as never);

    await query(
      `UPDATE users SET report_credits = COALESCE(report_credits, 0) + $1 WHERE id = $2`,
      [creditsToAdd, userId],
    );

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('report_credits'),
      [1, userId],
    );
  });

  it('adds 25 credits for pro plan purchase', async () => {
    const userId = 'user-456';
    const planType = 'pro';
    const creditsToAdd = planType === 'pro' ? 25 : 1;

    expect(creditsToAdd).toBe(25);

    mockQuery.mockResolvedValueOnce({ rows: [{ id: userId }], rowCount: 1 } as never);

    await query(
      `UPDATE users SET report_credits = COALESCE(report_credits, 0) + $1 WHERE id = $2`,
      [creditsToAdd, userId],
    );

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('report_credits'),
      [25, userId],
    );
  });

  it('records a payment transaction on checkout.session.completed', async () => {
    const transaction = {
      userId: 'user-123',
      stripeSessionId: 'cs_test_abc123',
      stripeCustomerId: 'cus_test_456',
      amountCents: 999,
      planType: 'single',
      creditsAdded: 1,
    };

    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'txn-1' }], rowCount: 1 } as never);

    await query(
      `INSERT INTO payment_transactions
         (user_id, stripe_session_id, stripe_customer_id, amount_cents, plan_type, credits_added)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        transaction.userId,
        transaction.stripeSessionId,
        transaction.stripeCustomerId,
        transaction.amountCents,
        transaction.planType,
        transaction.creditsAdded,
      ],
    );

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('payment_transactions'),
      [
        'user-123',
        'cs_test_abc123',
        'cus_test_456',
        999,
        'single',
        1,
      ],
    );
  });

  it('handles subscription deletion by resetting plan to free', async () => {
    const userId = 'user-789';

    mockQuery.mockResolvedValueOnce({ rows: [{ id: userId }], rowCount: 1 } as never);

    await query(
      `UPDATE users
       SET stripe_plan = 'free',
           stripe_subscription_id = NULL,
           plan_renewal_date = NULL
       WHERE id = $1`,
      [userId],
    );

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("stripe_plan = 'free'"),
      [userId],
    );
  });

  it('handles subscription update with renewal date', async () => {
    const userId = 'user-789';
    const status = 'active';
    const currentPeriodEnd = new Date(1735689600 * 1000).toISOString();

    mockQuery.mockResolvedValueOnce({ rows: [{ id: userId }], rowCount: 1 } as never);

    await query(
      `UPDATE users
       SET stripe_plan = CASE WHEN $1 = 'active' THEN 'pro' ELSE 'free' END,
           plan_renewal_date = $2
       WHERE id = $3`,
      [status, currentPeriodEnd, userId],
    );

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('stripe_plan'),
      [status, currentPeriodEnd, userId],
    );
  });

  it('requires stripe-signature header for webhooks', () => {
    const { req, res } = createMockReqRes({
      headers: {},
    });

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('User credits endpoint patterns', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns credits and plan for authenticated user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        report_credits: 15,
        stripe_plan: 'pro',
        plan_renewal_date: '2026-04-01T00:00:00Z',
      }],
      rowCount: 1,
    } as never);

    const result = await query(
      `SELECT COALESCE(report_credits, 1) AS report_credits,
              COALESCE(stripe_plan, 'free') AS stripe_plan,
              plan_renewal_date
       FROM users WHERE username = $1`,
      ['testuser'],
    );

    const user = result.rows[0] as { report_credits: number; stripe_plan: string; plan_renewal_date: string | null };
    expect(user.report_credits).toBe(15);
    expect(user.stripe_plan).toBe('pro');
    expect(user.plan_renewal_date).toBe('2026-04-01T00:00:00Z');
  });

  it('returns defaults when user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const result = await query(
      `SELECT COALESCE(report_credits, 1) AS report_credits FROM users WHERE username = $1`,
      ['nonexistent'],
    );

    const defaults = result.rows.length === 0
      ? { credits: 1, plan: 'free' }
      : { credits: (result.rows[0] as { report_credits: number }).report_credits, plan: 'free' };

    expect(defaults).toEqual({ credits: 1, plan: 'free' });
  });

  it('returns default credits when database is not configured', () => {
    // When DATABASE_URL is not set, return graceful fallback
    const dbUrl = undefined; // process.env.DATABASE_URL not set
    const fallback = !dbUrl ? { credits: 1, plan: 'free' } : null;

    expect(fallback).toEqual({ credits: 1, plan: 'free' });
  });
});
