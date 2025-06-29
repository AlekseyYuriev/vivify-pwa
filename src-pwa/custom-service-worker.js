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

//events - push
self.addEventListener('push', (event) => {
  if (event.data) {
    let data = JSON.parse(event.data.text());
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: 'icons/android/android-launchericon-96-96.png',
        badge: 'icons/android/android-launchericon-96-96.png',
        data: {
          openUrl: data.openUrl,
        },
      })
    );
  }
});

//events - notifications
self.addEventListener('notificationclick', (event) => {
  let notification = event.notification;
  let action = event.action;

  notification.close();

  if (action === 'hello') {
    console.log('hello button clicked');
    return;
  }

  if (action === 'goodbye') {
    console.log('goodbye button clicked');
    return;
  }

  const openWindowPromise = (async () => {
    // Use the URL from the push data, but have a fallback to the root URL.
    const urlToOpen = notification.data?.openUrl || '/';

    // Get a list of all open app windows/tabs.
    const allClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    // Try to find a visible window to focus.
    const clientToFocus = allClients.find(
      (client) => client.visibilityState === 'visible'
    );

    if (clientToFocus) {
      // If we found a visible window, navigate it to the correct URL and focus it.
      await clientToFocus.navigate(urlToOpen);
      return clientToFocus.focus();
    } else {
      // If we didn't find a visible window, open a new one.
      return clients.openWindow(urlToOpen);
    }
  })();

  // ensures the service worker stays alive until the promise resolves.
  event.waitUntil(openWindowPromise);
});

self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed', event);
});
