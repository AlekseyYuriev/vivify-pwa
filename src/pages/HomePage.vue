<script setup>
import { ref, onMounted } from 'vue';
import { date, useQuasar } from 'quasar';
import axios from 'axios';

const $q = useQuasar();
const posts = ref([]);
const loadingPosts = ref(false);

const getPosts = () => {
  loadingPosts.value = true;
  axios
    .get('http://localhost:3000/posts')
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
    });
};

const formattedDate = (value) => {
  return date.formatDate(value, 'MMMM D h:mmA');
};

onMounted(() => {
  getPosts();
});
</script>

<template>
  <q-page class="constrain q-pa-md">
    <div class="row q-col-gutter-lg">
      <div class="col-12 col-sm-8">
        <template v-if="!loadingPosts && posts.length">
          <q-card
            v-for="post in posts"
            :key="post.id"
            class="card-post q-mb-md"
            flat
            bordered
          >
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
  .q-img
    min-height: 200px
</style>
