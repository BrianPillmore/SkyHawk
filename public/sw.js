// SkyHawk Service Worker — offline caching & PWA support
const CACHE_VERSION = 'skyhawk-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const TILES_CACHE = `${CACHE_VERSION}-tiles`;
const API_CACHE = `${CACHE_VERSION}-api`;

// App shell resources to pre-cache on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ---- Install: pre-cache app shell ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  // Activate immediately — don't wait for existing tabs to close
  self.skipWaiting();
});

// ---- Activate: clean old caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== TILES_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Claim all open clients immediately
  self.clients.claim();
});

// ---- Fetch: strategy-based routing ----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Google Maps tiles — cache limited recent tiles for offline viewing
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('google.com')
  ) {
    // Only cache map tile images
    if (url.pathname.includes('/vt') || url.pathname.includes('/maps')) {
      event.respondWith(networkFirstWithCache(request, TILES_CACHE, 200));
    }
    return;
  }

  // API calls — network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE, 50));
    return;
  }

  // Static assets (JS, CSS, images, fonts) — cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
    return;
  }

  // Navigation requests (HTML pages) — network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirstWithCache(request, STATIC_CACHE, 100).catch(() => {
        return caches.match('/index.html') || offlineFallback();
      })
    );
    return;
  }

  // Default: network-first
  event.respondWith(networkFirstWithCache(request, STATIC_CACHE, 100));
});

/**
 * Cache-first strategy: serve from cache, fall back to network.
 * Updates cache in the background when network succeeds.
 */
async function cacheFirstWithNetwork(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback();
  }
}

/**
 * Network-first strategy: try network, fall back to cache.
 * Optionally limits cache size by evicting oldest entries.
 */
async function networkFirstWithCache(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      // Evict old entries if over limit
      if (maxEntries) {
        trimCache(cacheName, maxEntries);
      }
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || offlineFallback();
  }
}

/**
 * Trim a named cache to a maximum number of entries (FIFO eviction).
 */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    // Delete oldest entries first
    const toDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

/**
 * Check if a path looks like a static asset.
 */
function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|eot|svg|png|jpe?g|gif|ico|webp|avif|json)$/i.test(pathname);
}

/**
 * Generate an offline fallback response.
 */
function offlineFallback() {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SkyHawk - Offline</title>
  <style>
    body {
      margin: 0; font-family: system-ui, -apple-system, sans-serif;
      background: #1e293b; color: #e2e8f0;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; text-align: center; padding: 2rem;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #94a3b8; font-size: 0.875rem; max-width: 28rem; }
    button {
      margin-top: 1.5rem; padding: 0.75rem 1.5rem;
      background: #3b82f6; color: white; border: none;
      border-radius: 0.5rem; font-size: 0.875rem; cursor: pointer;
    }
    button:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div>
    <h1>You are offline</h1>
    <p>SkyHawk requires an internet connection for satellite imagery and property data. Please check your connection and try again.</p>
    <button onclick="location.reload()">Retry</button>
  </div>
</body>
</html>`,
    {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}
