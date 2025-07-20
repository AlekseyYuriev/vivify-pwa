<script setup>
import { onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';

const deferredPrompt = ref(null);
const $q = useQuasar();

const showAppInstallBanner = ref(false);

const neverShowAppInstallBanner = () => {
  showAppInstallBanner.value = false;
  $q.localStorage.set('neverShowAppInstallBanner', true);
};

const installApp = () => {
  // Hide the app provided install promotion
  showAppInstallBanner.value = false;
  // Show the install prompt
  deferredPrompt.value.prompt();
  // Wait for the user to respond to the prompt
  deferredPrompt.value.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      neverShowAppInstallBanner();
    } else {
      console.log('User dismissed the install prompt');
    }
  });
};

onMounted(() => {
  // Check if user chose "Never"
  let neverShowAppInstallBanner = $q.localStorage.getItem('neverShowAppInstallBanner');

  if (!neverShowAppInstallBanner) {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      deferredPrompt.value = e;
      // Update UI notify the user they can install the PWA
      setTimeout(() => {
        showAppInstallBanner.value = true;
      }, 3000);
    });
  }
});
</script>

<template>
  <q-layout view="lHh Lpr lFf">
    <q-header class="bg-white text-grey-10" bordered>
      <q-toolbar class="constrain">
        <q-btn
          to="/camera"
          class="large-screen-only q-mr-sm"
          flat
          round
          icon="eva-camera-outline"
          size="18px"
          dense
        />
        <q-separator class="large-screen-only" vertical spaced />
        <q-toolbar-title class="text-grand-hotel text-bold tracking-wide"> Vivify </q-toolbar-title>
        <q-btn
          to="/"
          class="large-screen-only inline-flex"
          flat
          round
          icon="eva-home-outline"
          size="18px"
          dense
        />
      </q-toolbar>
    </q-header>

    <q-footer class="bg-white" bordered>
      <transition appear enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
        <div v-if="showAppInstallBanner" class="banner-container bg-primary">
          <div class="constrain">
            <q-banner inline-actions dense class="bg-primary text-white">
              <template v-slot:avatar>
                <q-avatar size="40px">
                  <img src="icons/favicon-96x96.png" />
                </q-avatar>
              </template>

              <b>Install Vivify?</b>

              <template v-slot:action>
                <q-btn @click="installApp" flat dense label="Yes" class="q-px-sm" />
                <q-btn
                  @click="showAppInstallBanner = false"
                  flat
                  dense
                  label="Later"
                  class="q-px-sm"
                />
                <q-btn
                  @click="neverShowAppInstallBanner"
                  flat
                  dense
                  label="Never"
                  class="q-px-sm"
                />
              </template>
            </q-banner>
          </div>
        </div>
      </transition>
      <q-tabs
        class="text-grey-10 small-screen-only"
        active-color="primary"
        indicator-color="transparent"
      >
        <q-route-tab to="/" icon="eva-home-outline" />
        <q-route-tab to="/camera" icon="eva-camera-outline" />
      </q-tabs>
    </q-footer>

    <q-page-container class="bg-grey-1">
      <router-view v-slot="{ Component }">
        <keep-alive :include="['HomePage']">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </q-page-container>
  </q-layout>
</template>

<style lang="sass">
.q-toolbar
  @media (min-width: $breakpoint-sm-min)
    height: 77px
.q-toolbar__title
  font-size: 30px
  @media (max-width: $breakpoint-xs-max)
    text-align: center
.constrain
  .q-banner__avatar
    .q-avatar
      .q-avatar__content
        border-radius: 12px
.q-footer
  .q-tab__icon
    font-size: 30px
.platform-ios
  .q-footer
    padding-bottom: constant(safe-area-inset-bottom)
    padding-bottom: env(safe-area-inset-bottom)
</style>
