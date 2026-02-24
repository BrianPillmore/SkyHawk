import { Router, type Request, type Response } from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// Stripe SDK — lazy-loaded so the server doesn't crash if stripe is missing
// ---------------------------------------------------------------------------
interface StripeInstance {
  checkout: {
    sessions: {
      create: (params: Record<string, unknown>) => Promise<{ id: string; url: string }>;
    };
  };
  webhooks: {
    constructEvent: (body: string | Buffer, sig: string, secret: string) => StripeEvent;
  };
}

interface StripeEvent {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

let stripeInstance: StripeInstance | null = null;

function getStripe(): StripeInstance | null {
  if (stripeInstance) return stripeInstance;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.warn('STRIPE_SECRET_KEY not configured — Stripe endpoints disabled');
    return null;
  }
  try {
    // Dynamic import workaround for optional dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require('stripe');
    stripeInstance = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' }) as StripeInstance;
    return stripeInstance;
  } catch {
    console.warn('stripe package not installed — Stripe endpoints disabled');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ensure the user_credits infrastructure columns exist (idempotent). */
async function ensureCreditColumns(): Promise<void> {
  try {
    await query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS report_credits INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS stripe_plan VARCHAR(50) DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS plan_renewal_date TIMESTAMPTZ
    `);
  } catch {
    // Column may already exist or DB not available — non-fatal
  }
}

/** Ensure the transactions table exists. */
async function ensureTransactionsTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        stripe_session_id VARCHAR(255) NOT NULL,
        stripe_customer_id VARCHAR(255),
        amount_cents INTEGER NOT NULL,
        currency VARCHAR(10) DEFAULT 'usd',
        plan_type VARCHAR(50) NOT NULL,
        credits_added INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch {
    // Non-fatal
  }
}

// Run schema migrations on module load (non-blocking)
if (process.env.DATABASE_URL) {
  ensureCreditColumns().catch(() => {});
  ensureTransactionsTable().catch(() => {});
}

// ---------------------------------------------------------------------------
// POST /api/checkout/session — Create a Stripe Checkout Session
// ---------------------------------------------------------------------------
router.post('/session', requireAuth, async (req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: 'Payment processing is not configured' });
      return;
    }

    const { priceId, userId } = req.body as { priceId?: string; userId?: string };

    if (!priceId) {
      res.status(400).json({ error: 'priceId is required' });
      return;
    }

    // Determine plan type from price ID
    const priceSingle = process.env.STRIPE_PRICE_SINGLE || '';
    const pricePro = process.env.STRIPE_PRICE_PRO || '';

    let planType: 'single' | 'pro';
    let mode: 'payment' | 'subscription';

    if (priceId === priceSingle) {
      planType = 'single';
      mode = 'payment';
    } else if (priceId === pricePro) {
      planType = 'pro';
      mode = 'subscription';
    } else {
      res.status(400).json({ error: 'Invalid priceId' });
      return;
    }

    // Resolve the authenticated user
    const authUser = (req as Request & { user: { username: string; userId?: string } }).user;
    const resolvedUserId = userId || authUser.userId;

    const origin = process.env.CORS_ORIGIN || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/gotruf/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/gotruf/checkout/cancel`,
      metadata: {
        userId: resolvedUserId || '',
        planType,
      },
      ...(mode === 'subscription' ? { subscription_data: { metadata: { userId: resolvedUserId || '', planType } } } : {}),
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Checkout session creation error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe — Stripe webhook handler (no auth required)
// ---------------------------------------------------------------------------
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: 'Stripe not configured' });
      return;
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      res.status(503).json({ error: 'Webhook secret not configured' });
      return;
    }

    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    let event: StripeEvent;
    try {
      // req.body should be the raw body buffer for webhook verification
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Record<string, unknown>;
        const metadata = session.metadata as Record<string, string> | undefined;
        const userId = metadata?.userId;
        const planType = metadata?.planType || 'single';

        if (userId && process.env.DATABASE_URL) {
          const creditsToAdd = planType === 'pro' ? 25 : 1;
          const amountTotal = (session.amount_total as number) || 0;
          const customerId = (session.customer as string) || '';

          // Add credits to user
          await query(
            `UPDATE users
             SET report_credits = COALESCE(report_credits, 0) + $1,
                 stripe_customer_id = COALESCE($2, stripe_customer_id),
                 stripe_plan = $3,
                 stripe_subscription_id = COALESCE($4, stripe_subscription_id)
             WHERE id = $5`,
            [
              creditsToAdd,
              customerId || null,
              planType,
              (session.subscription as string) || null,
              userId,
            ],
          );

          // Record transaction
          await query(
            `INSERT INTO payment_transactions
               (user_id, stripe_session_id, stripe_customer_id, amount_cents, plan_type, credits_added)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, session.id, customerId, amountTotal, planType, creditsToAdd],
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Record<string, unknown>;
        const metadata = subscription.metadata as Record<string, string> | undefined;
        const userId = metadata?.userId;
        const status = subscription.status as string;

        if (userId && process.env.DATABASE_URL) {
          const currentPeriodEnd = subscription.current_period_end
            ? new Date((subscription.current_period_end as number) * 1000).toISOString()
            : null;

          await query(
            `UPDATE users
             SET stripe_plan = CASE WHEN $1 = 'active' THEN 'pro' ELSE 'free' END,
                 plan_renewal_date = $2
             WHERE id = $3`,
            [status, currentPeriodEnd, userId],
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Record<string, unknown>;
        const metadata = subscription.metadata as Record<string, string> | undefined;
        const userId = metadata?.userId;

        if (userId && process.env.DATABASE_URL) {
          await query(
            `UPDATE users
             SET stripe_plan = 'free',
                 stripe_subscription_id = NULL,
                 plan_renewal_date = NULL
             WHERE id = $1`,
            [userId],
          );
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/credits — Get user's remaining report credits
// ---------------------------------------------------------------------------
router.get('/credits', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      // Graceful fallback when DB not configured
      res.json({ credits: 1, plan: 'free' });
      return;
    }

    const authUser = (req as Request & { user: { username: string; userId?: string } }).user;
    const username = authUser.username;

    const result = await query<{
      report_credits: number;
      stripe_plan: string;
      plan_renewal_date: string | null;
    }>(
      `SELECT COALESCE(report_credits, 1) AS report_credits,
              COALESCE(stripe_plan, 'free') AS stripe_plan,
              plan_renewal_date
       FROM users
       WHERE username = $1`,
      [username],
    );

    if (result.rows.length === 0) {
      res.json({ credits: 1, plan: 'free' });
      return;
    }

    const user = result.rows[0];
    res.json({
      credits: user.report_credits,
      plan: user.stripe_plan,
      ...(user.plan_renewal_date ? { nextRenewal: user.plan_renewal_date } : {}),
    });
  } catch (err) {
    console.error('Get credits error:', err);
    res.status(500).json({ error: 'Failed to retrieve credits' });
  }
});

export { router as checkoutRouter };
