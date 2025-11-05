// Service Worker for Conference Games
const CACHE_NAME = 'conference-games-v1';
const STATIC_CACHE_NAME = 'conference-games-static-v1';
const API_CACHE_NAME = 'conference-games-api-v1';

// Static assets to cache (will be updated dynamically based on build output)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Dynamic asset patterns to cache
const ASSET_PATTERNS = [
  /\/js\/.*\.js$/,
  /\/css\/.*\.css$/,
  /\/images\/.*\.(png|jpg|jpeg|gif|svg|ico)$/,
  /\/assets\/.*\.(woff|woff2|ttf|eot)$/
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/sentences',
  '/api/acronyms'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      }),
      caches.open(API_CACHE_NAME)
    ]).then(() => {
      console.log('Service Worker installed successfully');
      // Force activation of new service worker
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && 
              cacheName !== API_CACHE_NAME && 
              cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      networkFirstStrategy(request, API_CACHE_NAME)
    );
    return;
  }

  // Handle static assets with cache-first strategy
  if (isStaticAsset(url.pathname) || matchesAssetPattern(url.pathname)) {
    event.respondWith(
      cacheFirstStrategy(request, STATIC_CACHE_NAME)
    );
    return;
  }

  // Handle navigation requests with network-first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirstStrategy(request, STATIC_CACHE_NAME, '/index.html')
    );
    return;
  }
});

// Network-first strategy for API calls and navigation
async function networkFirstStrategy(request, cacheName, fallbackUrl = null) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
  } catch (error) {
    console.log('Network failed, trying cache:', request.url);
    
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If we have a fallback URL (for navigation), try that
    if (fallbackUrl) {
      const fallbackResponse = await caches.match(fallbackUrl);
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }
    
    // Return a custom offline page or error
    return new Response(
      JSON.stringify({ 
        error: 'Content not available offline',
        offline: true 
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Cache-first strategy for static assets
async function cacheFirstStrategy(request, cacheName) {
  // Try cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Fallback to network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the response
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Failed to fetch asset:', request.url);
    return new Response('Asset not available', { status: 404 });
  }
}

// Check if URL is a static asset
function isStaticAsset(pathname) {
  return pathname.startsWith('/static/') ||
         pathname.startsWith('/assets/') ||
         pathname.endsWith('.js') ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.jpeg') ||
         pathname.endsWith('.gif') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.ico') ||
         pathname.endsWith('.woff') ||
         pathname.endsWith('.woff2') ||
         pathname.endsWith('.ttf');
}

// Check if URL matches dynamic asset patterns
function matchesAssetPattern(pathname) {
  return ASSET_PATTERNS.some(pattern => pattern.test(pathname));
}

// Handle background sync for offline actions (future enhancement)
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle any background sync tasks
      Promise.resolve()
    );
  }
});

// Handle push notifications (future enhancement)
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('Conference Games', options)
  );
});