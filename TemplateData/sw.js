/* sw.js — Unity WebGL PWA */
/* Uses Workbox via CDN. If your CSP blocks CDNs, host workbox-sw.js locally. */
importScripts('https://cdnjs.cloudflare.com/ajax/libs/workbox-sw/7.3.0/workbox-sw.js');

/* Basic SW lifecycle */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
workbox.core.clientsClaim();
workbox.core.setCacheNameDetails({ prefix: 'unity-pwa' });

/* Enable navigation preload for faster first paint */
if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

/* -------- Precaching --------
   If you use Workbox injectManifest at build time, it will replace
   self.__WB_MANIFEST with an array of revisioned assets. Otherwise
   this remains undefined and only offline.html is precached. */
const precacheList = (self.__WB_MANIFEST || []).concat([
  { url: '/offline.html', revision: '1' }, // update rev when you edit the file
]);
workbox.precaching.precacheAndRoute(precacheList);

/* -------- Offline fallback for page navigations -------- */
workbox.recipes.offlineFallback({
  pageFallback: '/offline.html',
});

/* -------- Runtime caching: Unity build payload --------
   Cache-first is recommended for hashed / revisioned payloads. */
const unityBuildMatcher = ({ url, request }) => {
  if (request.method !== 'GET') return false;
  const p = url.pathname;
  // Unity 2019+ commonly emits .data.unityweb / .wasm.unityweb / .framework.js.unityweb / .loader.js
  // Also support legacy .gz/.br variants if you use Compression Fallback.
  return (
    /\.(data|wasm|framework\.js|loader\.js)(\.unityweb)?$/i.test(p) ||
    /\.(data|wasm|js)\.(br|gz)$/i.test(p)
  );
};

workbox.routing.registerRoute(
  unityBuildMatcher,
  new workbox.strategies.CacheFirst({
    cacheName: 'unity-build',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }),
      // Keep a reasonable cap; adjust based on how many build files you ship.
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 40,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

/* Optional: cache other static assets (images, fonts, CSS/JS) */
workbox.routing.registerRoute(
  ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'static-assets',
    plugins: [new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] })],
  })
);

/* Optional: network-first for HTML pages (navigate) to prefer fresh,
   with fallback handled by recipes.offlineFallback above. */
workbox.routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  new workbox.strategies.NetworkFirst({
    cacheName: 'pages',
    networkTimeoutSeconds: 4,
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }),
      new workbox.expiration.ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 7 * 24 * 3600 }),
    ],
  })
);
