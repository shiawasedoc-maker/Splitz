/* sw.js — offline support for หารค่าทริป
 *
 * What this file does:
 *   - On install, downloads and caches the app's own files (list below) from the site that hosts the app.
 *   - Afterwards, serves those files from the cache, so the app opens and works with no Internet.
 *
 * What it does NOT do:
 *   - It never sends, uploads, or caches any trip/expense data (that data lives in IndexedDB and never passes through here).
 *   - It ignores every request to another origin; there are no third-party requests in the app.
 *
 * The only network traffic it causes: GET requests for the files below, from the host (e.g. GitHub Pages),
 * when the app is installed or updated. To ship an update, change VERSION.
 */
const VERSION = 'tripsplit-v5';
const APP_FILES = [
  './', './index.html', './app.js', './db.js', './manifest.webmanifest',
  './icon-180.png', './icon-192.png', './icon-512.png',
  './vendor/html2canvas.min.js', './vendor/jspdf.umd.min.js', './vendor/xlsx.full.min.js',
  './fonts/anuphan-thai-400-normal.woff2', './fonts/anuphan-thai-500-normal.woff2', './fonts/anuphan-thai-600-normal.woff2', './fonts/anuphan-thai-700-normal.woff2',
  './fonts/anuphan-latin-400-normal.woff2', './fonts/anuphan-latin-500-normal.woff2', './fonts/anuphan-latin-600-normal.woff2', './fonts/anuphan-latin-700-normal.woff2',
  './fonts/mitr-thai-400-normal.woff2', './fonts/mitr-thai-500-normal.woff2', './fonts/mitr-thai-600-normal.woff2',
  './fonts/mitr-latin-400-normal.woff2', './fonts/mitr-latin-500-normal.woff2', './fonts/mitr-latin-600-normal.woff2'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                              // the app never sends data; nothing to intercept
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;               // never touch other sites
  if (req.mode === 'navigate') {                                  // opening the app: always the cached shell (offline-first)
    event.respondWith(caches.match('./index.html').then(hit => hit || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
