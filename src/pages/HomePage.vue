<script setup>
import { ref, onMounted, computed, onActivated } from 'vue';
import { date, useQuasar } from 'quasar';
import { openDB } from 'idb';
import { api } from 'boot/axios';
import qs from 'qs';

const $q = useQuasar();
const posts = ref([]);
const loadingPosts = ref(false);
const showNotificationsBanner = ref(false);

const seviceWorkerSupported = computed(() =>
  'serviceWorker' in navigator ? true : false
);

const pushNotificationsSupported = computed(() =>
  'PushManager' in window ? true : false
);

const getPosts = () => {
  loadingPosts.value = true;
  api
    .get('/posts')
    .then((response) => {
      posts.value = response.data;
    })
    .catch((err) => {
      $q.dialog({
        title: 'Error',
        message: 'Could not download posts',
      });
    })
    .finally(() => {
      loadingPosts.value = false;
      if (!navigator.onLine) {
        getOfflinePosts();
      }
    });
};

const getOfflinePosts = async () => {
  try {
    let db = await openDB('workbox-background-sync');
    let failedRequests = await db.getAll('requests');

    failedRequests.forEach((failedRequest) => {
      if (failedRequest.queueName === 'createPostQueue') {
        let request = new Request(
          failedRequest.requestData.url,
          failedRequest.requestData
        );
        request.formData().then((formData) => {
          let offlinePost = {};

          offlinePost.id = formData.get('id');
          offlinePost.caption = formData.get('caption');
          offlinePost.location = formData.get('location');
          offlinePost.date = parseInt(formData.get('date'));
          offlinePost.offline = true;

          let reader = new FileReader();

          reader.readAsDataURL(formData.get('file'));
          reader.onloadend = () => {
            offlinePost.imageUrl = reader.result;
            posts.value.unshift(offlinePost);
          };
        });
      }
    });
  } catch (error) {
    console.log(error);
  }
};

const listenForOfflinePostUploaded = () => {
  if (seviceWorkerSupported.value) {
    const channel = new BroadcastChannel('sw-messages');
    channel.addEventListener('message', (event) => {
      if (event.data.msg === 'offline-post-uploaded') {
        let offlinePostCount = posts.value.filter(
          (post) => post.offline === true
        ).length;
        posts.value[offlinePostCount - 1].offline = false;
      }
    });
  }
};

const formattedDate = (value) => {
  return date.formatDate(value, 'MMMM D h:mmA');
};

const initNotificationsBanner = () => {
  if (!$q.localStorage.getItem('neverShowNotificationsBanner')) {
    showNotificationsBanner.value = true;
  }
};

const enableNotifications = async () => {
  if (pushNotificationsSupported.value) {
    Notification.requestPermission((result) => {
      neverShowNotificationsBanner();
      if (result === 'granted') {
        // displayGrantedNotification();
        checkForExistingPushSubscription();
      }
    });
  }
};

const checkForExistingPushSubscription = () => {
  if (seviceWorkerSupported.value && pushNotificationsSupported.value) {
    let reg;
    navigator.serviceWorker.ready
      .then((swreg) => {
        reg = swreg;
        return swreg.pushManager.getSubscription();
      })
      .then((sub) => {
        if (!sub) {
          createPushSubscription(reg);
        }
      });
  }
};

const createPushSubscription = (reg) => {
  reg.pushManager
    .subscribe({
      userVisibleOnly: true,
      applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
    })
    .then((sub) => {
      let newSubData = sub.toJSON();
      let newSubDataQS = qs.stringify(newSubData);

      return api.post(`/createSubscription?${newSubDataQS}`);
    })
    .then((response) => {
      displayGrantedNotification();
    })
    .catch((err) => {
      console.log(err);
    });
};

const displayGrantedNotification = () => {
  // new Notification('You are now subscribed to notifications', {
  //   body: 'Thanks for subscribing!',
  //   icon: 'icons/android/android-launchericon-96-96.png',
  //   image: 'icons/windows11/Wide310x150Logo.scale-100.png',
  //   badge: 'icons/android/android-launchericon-96-96.png',
  //   dir: 'ltr',
  //   lang: 'en-US',
  //   vibrate: [100, 50, 200],
  //   tag: 'confirm-notification',
  //   renotify: true,
  // });

  if (seviceWorkerSupported.value && pushNotificationsSupported.value) {
    navigator.serviceWorker.ready.then((swreg) => {
      swreg.showNotification('You are now subscribed to notifications', {
        body: 'Thanks for subscribing!',
        icon: 'icons/android/android-launchericon-96-96.png',
        image: 'icons/windows11/Wide310x150Logo.scale-100.png',
        badge: 'icons/android/android-launchericon-96-96.png',
        dir: 'ltr',
        lang: 'en-US',
        vibrate: [100, 50, 200],
        tag: 'confirm-notification',
        renotify: true,
        actions: [
          {
            action: 'hello',
            title: 'Hello',
            icon: 'icons/android/android-launchericon-96-96.png',
          },
          {
            action: 'goodbye',
            title: 'Goodbye',
            icon: 'icons/android/android-launchericon-96-96.png',
          },
        ],
      });
    });
  }
};

const neverShowNotificationsBanner = () => {
  showNotificationsBanner.value = false;
  $q.localStorage.set('neverShowNotificationsBanner', true);
};

onActivated(() => {
  getPosts();
});

onMounted(() => {
  listenForOfflinePostUploaded();
  initNotificationsBanner();
});
</script>

<template>
  <q-page class="constrain q-pa-md">
    <transition
      appear
      enter-active-class="animated fadeIn"
      leave-active-class="animated fadeOut"
    >
      <div
        v-if="showNotificationsBanner && pushNotificationsSupported"
        class="banner-container bg-primary"
      >
        <div class="constrain">
          <q-banner class="bg-grey-3 q-mb-md">
            <template v-slot:avatar>
              <q-icon name="eva-bell-outline" color="primary" size="32px" />
            </template>

            Would you like to enable notifications?

            <template v-slot:action>
              <q-btn
                @click="enableNotifications"
                flat
                dense
                label="Yes"
                color="primary"
                class="q-px-sm"
              />
              <q-btn
                @click="showNotificationsBanner = false"
                flat
                dense
                label="Later"
                color="primary"
                class="q-px-sm"
              />
              <q-btn
                @click="neverShowNotificationsBanner"
                flat
                dense
                label="Never"
                color="primary"
                class="q-px-sm"
              />
            </template>
          </q-banner>
        </div>
      </div>
    </transition>
    <div class="row q-col-gutter-lg">
      <div class="col-12 col-sm-8">
        <template v-if="!loadingPosts && posts.length">
          <q-card
            v-for="post in posts"
            :key="post.id"
            class="card-post q-mb-md"
            :class="{ 'bg-red-1': post.offline }"
            flat
            bordered
          >
            <q-badge
              v-if="post.offline"
              color="red"
              class="badge-offline absolute-top-right"
            >
              Stored offline
            </q-badge>
            <q-item>
              <q-item-section avatar>
                <q-avatar>
                  <img
                    src="https://lh3.googleusercontent.com/a/ACg8ocJ3wvy85ySAZvODI1U0j6LTU2d2psC4XNoxsj-s-1GrCMrhj1SF=s288-c-no"
                  />
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <q-item-label class="text-bold">vue_dev</q-item-label>
                <q-item-label caption>
                  {{ post.location }}
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-separator />

            <q-img :src="post.imageUrl" />

            <q-card-section>
              <div>{{ post.caption }}</div>
              <div class="text-caption text-grey">
                {{ formattedDate(post.date) }}
              </div>
            </q-card-section>
          </q-card>
        </template>
        <template v-else-if="!loadingPosts && !posts.length">
          <h5 class="text-center text-grey">No posts yet.</h5>
        </template>
        <template v-else>
          <q-card
            v-for="(item, index) in 3"
            :key="index"
            class="card-post q-mb-md"
            flat
            bordered
          >
            <q-item>
              <q-item-section avatar>
                <q-skeleton type="QAvatar" animation="fade" size="40px" />
              </q-item-section>

              <q-item-section>
                <q-item-label>
                  <q-skeleton type="text" animation="fade" />
                </q-item-label>
                <q-item-label caption>
                  <q-skeleton type="text" animation="fade" />
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-skeleton height="200px" square animation="fade" />

            <q-card-section>
              <q-skeleton type="text" class="text-subtitle2" animation="fade" />
              <q-skeleton
                type="text"
                width="50%"
                class="text-subtitle2"
                animation="fade"
              />
            </q-card-section>
          </q-card>
        </template>
      </div>
      <div class="col-4 large-screen-only">
        <q-item class="fixed">
          <q-item-section avatar>
            <q-avatar size="48px">
              <img
                src="https://lh3.googleusercontent.com/a/ACg8ocJ3wvy85ySAZvODI1U0j6LTU2d2psC4XNoxsj-s-1GrCMrhj1SF=s288-c-no"
              />
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-bold">vue_dev</q-item-label>
            <q-item-label caption> Vue Developer </q-item-label>
          </q-item-section>
        </q-item>
      </div>
    </div>
  </q-page>
</template>

<style lang="sass">
.card-post
  .badge-offline
    border-top-left-radius: 0 !important
  .q-img
    min-height: 200px
</style>
