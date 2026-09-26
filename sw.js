// Offline support: the app shell is cached on install, then every request is
// answered from the cache while a fresh copy is fetched in the background
// (stale-while-revalidate). A new deploy therefore shows up on the next launch.
const CACHE = 'cbt-diary-v1';

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/chart.js',
  'js/dom.js',
  'js/emotions.js',
  'js/export.js',
  'js/fields.js',
  'js/i18n.js',
  'js/store.js',
  'js/locales/en.js',
  'js/locales/fi.js',
  'js/locales/ru.js',
  'js/locales/uk.js',
  'js/views/charts.js',
  'js/views/diary.js',
  'js/views/entry.js',
  'js/views/guide.js',
  'js/guide/en.js',
  'js/guide/fi.js',
  'js/guide/ru.js',
  'js/guide/uk.js',
  'js/views/settings.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(fresh);
        return cached;
      }
      return fresh;
    }),
  );
});
