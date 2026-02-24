/**
 * Analytics tracking utility.
 * Supports Google Analytics 4 (gtag.js) and Plausible Analytics.
 * GDPR-friendly: no tracking until consent is granted.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let initialized = false;
let consentGranted = false;
let gaTrackingId: string | null = null;
let plausibleDomain: string | null = null;
let pendingEvents: Array<{ category: string; action: string; label?: string; value?: number }> = [];
let pendingPageViews: string[] = [];

// ---------------------------------------------------------------------------
// Consent Management (GDPR)
// ---------------------------------------------------------------------------

/**
 * Set the user's tracking consent. When consent is granted, any events
 * that were queued while consent was pending will be flushed.
 */
export function setConsent(granted: boolean): void {
  consentGranted = granted;

  if (granted && initialized) {
    // Flush pending page views
    for (const path of pendingPageViews) {
      trackPageView(path);
    }
    pendingPageViews = [];

    // Flush pending events
    for (const evt of pendingEvents) {
      trackEvent(evt.category, evt.action, evt.label, evt.value);
    }
    pendingEvents = [];

    // Update GA consent mode if available
    if (gaTrackingId && typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize analytics providers based on environment variables.
 *
 * - `VITE_GA_TRACKING_ID` — enables Google Analytics 4
 * - `VITE_PLAUSIBLE_DOMAIN` — enables Plausible Analytics
 *
 * Call this once on application startup. Passing a `trackingId` overrides
 * the env var for GA (useful in tests).
 */
export function initAnalytics(trackingId?: string): void {
  if (typeof window === 'undefined') return;
  if (initialized) return;

  gaTrackingId = trackingId || import.meta.env.VITE_GA_TRACKING_ID || null;
  plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN || null;

  // --- Google Analytics 4 (gtag.js) ---
  if (gaTrackingId) {
    // Load the gtag.js script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaTrackingId}`;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      // eslint-disable-next-line prefer-rest-params
      (window.dataLayer as unknown[]).push(args);
    };
    window.gtag('js', new Date());

    // Default to denied until consent is given
    window.gtag('consent', 'default', {
      analytics_storage: consentGranted ? 'granted' : 'denied',
    });

    window.gtag('config', gaTrackingId, {
      send_page_view: false, // We'll send page views manually
    });
  }

  // --- Plausible Analytics ---
  if (plausibleDomain) {
    const script = document.createElement('script');
    script.defer = true;
    script.dataset.domain = plausibleDomain;
    script.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(script);
  }

  initialized = true;
}

// ---------------------------------------------------------------------------
// Page View Tracking
// ---------------------------------------------------------------------------

/**
 * Track a page view. If consent has not been granted, the event is queued.
 */
export function trackPageView(path: string): void {
  if (!initialized) return;

  if (!consentGranted) {
    pendingPageViews.push(path);
    return;
  }

  // Google Analytics
  if (gaTrackingId && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: document.title,
    });
  }

  // Plausible (auto-tracks page views via its script, but we can push manual ones)
  if (plausibleDomain && typeof window.plausible === 'function') {
    window.plausible('pageview', { u: `${window.location.origin}${path}` });
  }
}

// ---------------------------------------------------------------------------
// Event Tracking
// ---------------------------------------------------------------------------

/**
 * Track a custom event. If consent has not been granted, the event is queued.
 */
export function trackEvent(
  category: string,
  action: string,
  label?: string,
  value?: number,
): void {
  if (!initialized) return;

  if (!consentGranted) {
    pendingEvents.push({ category, action, label, value });
    return;
  }

  // Google Analytics
  if (gaTrackingId && typeof window.gtag === 'function') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value,
    });
  }

  // Plausible
  if (plausibleDomain && typeof window.plausible === 'function') {
    window.plausible(action, {
      props: {
        category,
        label: label || '',
        value: value ?? 0,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Reset (for testing)
// ---------------------------------------------------------------------------

/** Reset all analytics state. Used in tests. */
export function _resetAnalytics(): void {
  initialized = false;
  consentGranted = false;
  gaTrackingId = null;
  plausibleDomain = null;
  pendingEvents = [];
  pendingPageViews = [];
}

// ---------------------------------------------------------------------------
// Type declarations for window extensions
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    plausible?: (event: string, options?: Record<string, unknown>) => void;
  }
}
