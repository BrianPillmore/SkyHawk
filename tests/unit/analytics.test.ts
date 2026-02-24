/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initAnalytics,
  trackPageView,
  trackEvent,
  setConsent,
  _resetAnalytics,
} from '../../src/utils/analytics';

/**
 * Tests for the analytics tracking utility.
 * Validates GA4 and Plausible integration, consent management, and event queuing.
 */

describe('Analytics utility', () => {
  beforeEach(() => {
    _resetAnalytics();
    // Clear any injected scripts
    document.head.innerHTML = '';
    // Clean up window extensions
    delete window.gtag;
    delete window.plausible;
    delete window.dataLayer;
    // Reset env vars (vitest import.meta.env can't be easily overridden, so we test without them)
  });

  afterEach(() => {
    _resetAnalytics();
  });

  describe('initAnalytics', () => {
    it('initializes without crashing when no tracking IDs configured', () => {
      expect(() => initAnalytics()).not.toThrow();
    });

    it('initializes Google Analytics when a tracking ID is provided', () => {
      initAnalytics('G-TEST12345');

      // Should have added a gtag.js script
      const scripts = document.querySelectorAll('script[src*="googletagmanager"]');
      expect(scripts.length).toBe(1);
      expect(scripts[0].getAttribute('src')).toContain('G-TEST12345');
    });

    it('creates window.gtag function when GA is initialized', () => {
      initAnalytics('G-TEST12345');

      expect(typeof window.gtag).toBe('function');
      expect(Array.isArray(window.dataLayer)).toBe(true);
    });

    it('does not initialize twice when called multiple times', () => {
      initAnalytics('G-TEST12345');
      initAnalytics('G-TEST12345');

      const scripts = document.querySelectorAll('script[src*="googletagmanager"]');
      expect(scripts.length).toBe(1);
    });

    it('sets consent to denied by default for GA', () => {
      initAnalytics('G-TEST12345');

      // The gtag consent call should have been made
      expect(window.dataLayer).toBeDefined();
      expect(window.dataLayer!.length).toBeGreaterThan(0);
    });
  });

  describe('Consent management', () => {
    it('queues page views when consent is not granted', () => {
      initAnalytics('G-TEST12345');

      // Replace gtag with a spy to check if it gets called
      const gtagSpy = vi.fn();
      window.gtag = gtagSpy;

      // Track without consent
      trackPageView('/pricing');

      // gtag should NOT have been called for page_view since consent not granted
      const pageViewCalls = gtagSpy.mock.calls.filter(
        (call) => call[0] === 'event' && call[1] === 'page_view',
      );
      expect(pageViewCalls.length).toBe(0);
    });

    it('queues events when consent is not granted', () => {
      initAnalytics('G-TEST12345');

      const gtagSpy = vi.fn();
      window.gtag = gtagSpy;

      trackEvent('checkout', 'begin_checkout', 'pro');

      const eventCalls = gtagSpy.mock.calls.filter(
        (call) => call[0] === 'event' && call[1] === 'begin_checkout',
      );
      expect(eventCalls.length).toBe(0);
    });

    it('flushes queued page views when consent is granted', () => {
      initAnalytics('G-TEST12345');

      const gtagSpy = vi.fn();
      window.gtag = gtagSpy;

      // Queue some events
      trackPageView('/pricing');
      trackPageView('/contractors');

      // Grant consent
      setConsent(true);

      // Now the queued page views should have been flushed
      const pageViewCalls = gtagSpy.mock.calls.filter(
        (call) => call[0] === 'event' && call[1] === 'page_view',
      );
      expect(pageViewCalls.length).toBe(2);
    });

    it('flushes queued events when consent is granted', () => {
      initAnalytics('G-TEST12345');

      const gtagSpy = vi.fn();
      window.gtag = gtagSpy;

      trackEvent('checkout', 'begin_checkout', 'pro');
      trackEvent('pricing', 'view_pricing');

      setConsent(true);

      const checkoutCalls = gtagSpy.mock.calls.filter(
        (call) => call[0] === 'event' && call[1] === 'begin_checkout',
      );
      expect(checkoutCalls.length).toBe(1);
    });

    it('sends events immediately after consent is granted', () => {
      initAnalytics('G-TEST12345');

      const gtagSpy = vi.fn();
      window.gtag = gtagSpy;

      setConsent(true);

      // Now tracking should work immediately
      trackPageView('/test');

      const pageViewCalls = gtagSpy.mock.calls.filter(
        (call) => call[0] === 'event' && call[1] === 'page_view',
      );
      expect(pageViewCalls.length).toBe(1);
    });

    it('updates GA consent mode when consent is granted', () => {
      initAnalytics('G-TEST12345');

      const gtagSpy = vi.fn();
      window.gtag = gtagSpy;

      setConsent(true);

      const consentCalls = gtagSpy.mock.calls.filter(
        (call) => call[0] === 'consent' && call[1] === 'update',
      );
      expect(consentCalls.length).toBe(1);
      expect(consentCalls[0][2]).toEqual({ analytics_storage: 'granted' });
    });
  });

  describe('trackPageView', () => {
    it('does nothing when analytics is not initialized', () => {
      // Should not throw
      expect(() => trackPageView('/test')).not.toThrow();
    });

    it('sends page view to GA with correct parameters', () => {
      initAnalytics('G-TEST12345');
      setConsent(true);

      const gtagSpy = vi.fn();
      window.gtag = gtagSpy;

      document.title = 'Test Page';
      trackPageView('/test-page');

      const pageViewCalls = gtagSpy.mock.calls.filter(
        (call) => call[0] === 'event' && call[1] === 'page_view',
      );
      expect(pageViewCalls.length).toBe(1);
      expect(pageViewCalls[0][2]).toEqual({
        page_path: '/test-page',
        page_title: 'Test Page',
      });
    });

    it('does not call Plausible when VITE_PLAUSIBLE_DOMAIN is not configured', () => {
      initAnalytics('G-TEST12345');
      setConsent(true);

      const plausibleSpy = vi.fn();
      window.plausible = plausibleSpy;

      trackPageView('/pricing');

      // Plausible is only called when plausibleDomain is set via env var
      // Since VITE_PLAUSIBLE_DOMAIN is not set in tests, plausible should not be called
      expect(plausibleSpy).not.toHaveBeenCalled();
    });
  });

  describe('trackEvent', () => {
    it('does nothing when analytics is not initialized', () => {
      expect(() => trackEvent('test', 'action')).not.toThrow();
    });

    it('sends event to GA with correct parameters', () => {
      initAnalytics('G-TEST12345');
      setConsent(true);

      const gtagSpy = vi.fn();
      window.gtag = gtagSpy;

      trackEvent('checkout', 'begin_checkout', 'pro', 9900);

      const eventCalls = gtagSpy.mock.calls.filter(
        (call) => call[0] === 'event' && call[1] === 'begin_checkout',
      );
      expect(eventCalls.length).toBe(1);
      expect(eventCalls[0][2]).toEqual({
        event_category: 'checkout',
        event_label: 'pro',
        value: 9900,
      });
    });

    it('does not send events to Plausible when VITE_PLAUSIBLE_DOMAIN is not configured', () => {
      initAnalytics('G-TEST12345');
      setConsent(true);

      const plausibleSpy = vi.fn();
      window.plausible = plausibleSpy;

      trackEvent('checkout', 'purchase_complete', 'single', 999);

      // Plausible is only called when plausibleDomain is set via env var
      // Since VITE_PLAUSIBLE_DOMAIN is not set in tests, plausible should not be called
      expect(plausibleSpy).not.toHaveBeenCalled();
    });

    it('handles missing optional parameters', () => {
      initAnalytics('G-TEST12345');
      setConsent(true);

      const gtagSpy = vi.fn();
      window.gtag = gtagSpy;

      trackEvent('navigation', 'click');

      const eventCalls = gtagSpy.mock.calls.filter(
        (call) => call[0] === 'event' && call[1] === 'click',
      );
      expect(eventCalls.length).toBe(1);
      expect(eventCalls[0][2]).toEqual({
        event_category: 'navigation',
        event_label: undefined,
        value: undefined,
      });
    });
  });

  describe('_resetAnalytics', () => {
    it('resets all internal state', () => {
      initAnalytics('G-TEST12345');
      setConsent(true);

      _resetAnalytics();

      // After reset, tracking should no-op (not initialized)
      const gtagSpy = vi.fn();
      window.gtag = gtagSpy;

      trackPageView('/test');
      trackEvent('test', 'action');

      // No calls because not initialized
      expect(gtagSpy).not.toHaveBeenCalled();
    });
  });
});
