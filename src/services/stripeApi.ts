/**
 * Client-side Stripe API helpers.
 * Calls the backend checkout endpoints and handles redirects.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Price IDs from environment — these match the Stripe dashboard products
export const PRICE_IDS = {
  single: import.meta.env.VITE_STRIPE_PRICE_SINGLE || '',
  pro: import.meta.env.VITE_STRIPE_PRICE_PRO || '',
} as const;

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('skyhawk-storage');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.state?.token || null;
  } catch {
    return null;
  }
}

function getUserId(): string | null {
  try {
    const stored = localStorage.getItem('skyhawk-storage');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.state?.userId || null;
  } catch {
    return null;
  }
}

class StripeApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'StripeApiError';
  }
}

/**
 * Create a Stripe Checkout session and redirect the user.
 * Returns the checkout URL (the redirect happens automatically unless
 * the caller catches the response before it resolves).
 */
export async function createCheckoutSession(priceId: string): Promise<{ url: string }> {
  const token = getToken();
  if (!token) {
    throw new StripeApiError(401, 'Please log in to purchase a plan');
  }

  const userId = getUserId();

  const response = await fetch(`${API_BASE}/api/checkout/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ priceId, userId }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new StripeApiError(response.status, body.error || 'Failed to create checkout session');
  }

  const data = await response.json() as { sessionId: string; url: string };

  // Automatically redirect to Stripe Checkout
  if (data.url) {
    window.location.href = data.url;
  }

  return { url: data.url };
}

/**
 * Fetch the current user's report credits and plan info.
 */
export async function getUserCredits(): Promise<{
  credits: number;
  plan: string;
  nextRenewal?: string;
}> {
  const token = getToken();
  if (!token) {
    return { credits: 0, plan: 'free' };
  }

  try {
    const response = await fetch(`${API_BASE}/api/user/credits`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { credits: 0, plan: 'free' };
    }

    return await response.json();
  } catch {
    // Server unreachable — return defaults
    return { credits: 0, plan: 'free' };
  }
}
