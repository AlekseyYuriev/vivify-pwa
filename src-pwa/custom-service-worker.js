/* eslint-env serviceworker */

/*
 * This file (which will be your service worker)
 * is picked up by the build system ONLY if
 * quasar.config file > pwa > workboxMode is set to "InjectManifest"
 */

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import {
  StaleWhileRevalidate,
  CacheFirst,
  NetworkFirst,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { Queue } from 'workbox-background-sync';

// Use with precache injection
// disable workbox logs
self.__WB_DISABLE_DEV_LOGS = true;

precacheAndRoute(self.__WB_MANIFEST);

let backgroundSyncSupported = 'sync' in self.registration ? true : false;

// queue - createPost
let createPostQueue = null;
if (backgroundSyncSupported) {
  createPostQueue = new Queue('createPostQueue', {
    onSync: async ({ queue }) => {
      let entry;
      while ((entry = await queue.shiftRequest())) {
        try {
          await fetch(entry.request);
          const channel = new BroadcastChannel('sw-messages');
          channel.postMessage({ msg: 'offline-post-uploaded' });
        } catch (error) {
          console.error('Replay failed for request', entry.request, error);

          // Put the entry back in the queue and re-throw the error:
          await queue.unshiftRequest(entry);
          throw error;
        }
      }
    },
  });
}

//caching strategies
registerRoute(
  ({ url }) => url.host.startsWith('fonts.g'),
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/posts'),
  new NetworkFirst()
);

registerRoute(
  ({ url }) => url.href.startsWith('http'),
  new StaleWhileRevalidate()
);

//events - fetch
if (backgroundSyncSupported) {
  self.addEventListener('fetch', (event) => {
    if (!event.request.url.endsWith('/createPost')) {
      return;
    }

    const bgSyncLogic = async () => {
      try {
        const response = await fetch(event.request.clone());
        return response;
      } catch (error) {
        await createPostQueue.pushRequest({ request: event.request });
        return error;
      }
    };

    event.respondWith(bgSyncLogic());
  });
}

/*
self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();

// Non-SSR fallbacks to index.html
// Production SSR fallbacks to offline.html (except for dev)
if (process.env.MODE !== 'ssr' || process.env.PROD) {
  registerRoute(
    new NavigationRoute(
      createHandlerBoundToURL(process.env.PWA_FALLBACK_HTML),
      {
        denylist: [
          new RegExp(process.env.PWA_SERVICE_WORKER_REGEX),
          /workbox-(.)*\.js$/,
        ],
      }
    )
  );
}
*/
