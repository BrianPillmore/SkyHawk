/**
 * Service Worker registration utility for SkyHawk PWA.
 *
 * Provides functions to register the service worker, check browser support,
 * and handle update notifications.
 */

/** Check if the browser supports service workers */
export function isServiceWorkerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Register the SkyHawk service worker.
 *
 * @returns The ServiceWorkerRegistration on success, or null if unsupported / failed.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          // A new version is available — notify the user
          dispatchUpdateEvent();
        }
      });
    });

    return registration;
  } catch (err) {
    console.error('[SkyHawk] Service worker registration failed:', err);
    return null;
  }
}

/**
 * Dispatch a custom event that UI components can listen to for update prompts.
 */
function dispatchUpdateEvent(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('skyhawk-sw-update'));
  }
}

/**
 * Unregister all service workers (useful for development).
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) return false;

  const registration = await navigator.serviceWorker.getRegistration();
  if (registration) {
    return registration.unregister();
  }
  return false;
}
