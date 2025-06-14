<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { uid } from 'quasar';
import 'md-gum-polyfill';

const postData = reactive({
  id: uid(),
  caption: '',
  location: '',
  photo: null,
  date: Date.now(),
});
const imageCaptured = ref(false);
const imageUpload = ref([]);
const hasCameraSupport = ref(true);

const video = ref(null);
const canvas = ref(null);

const initCamera = () => {
  navigator.mediaDevices
    .getUserMedia({
      video: true,
    })
    .then((stream) => {
      video.value.srcObject = stream;
    })
    .catch((error) => {
      hasCameraSupport.value = false;
    });
};

const captureImage = () => {
  const videoElement = video.value;
  const canvasElement = canvas.value;

  canvasElement.width = videoElement.getBoundingClientRect().width;
  canvasElement.height = videoElement.getBoundingClientRect().height;

  const context = canvasElement.getContext('2d');
  context.drawImage(
    videoElement,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );
  imageCaptured.value = true;
  postData.photo = dataURItoBlob(canvasElement.toDataURL());
  disableCamera();
};

const captureImageFallback = (file) => {
  postData.photo = file;

  const canvasElement = canvas.value;
  const context = canvasElement.getContext('2d');

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      canvasElement.width = img.width;
      canvasElement.height = img.height;
      context.drawImage(img, 0, 0);
      imageCaptured.value = true;
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

const disableCamera = () => {
  video.value.srcObject.getVideoTracks().forEach((track) => {
    track.stop();
  });
};

const dataURItoBlob = (dataURI) => {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  var byteString = atob(dataURI.split(',')[1]);

  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);

  // create a view into the buffer
  var ia = new Uint8Array(ab);

  // set the bytes of the buffer to the correct values
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  var blob = new Blob([ab], { type: mimeString });
  return blob;
};

onMounted(() => {
  initCamera();
});

onBeforeUnmount(() => {
  if (hasCameraSupport.value) disableCamera();
});
</script>

<template>
  <q-page class="constrain-more q-pa-md">
    <div class="camera-frame q-pa-md">
      <video
        v-show="!imageCaptured"
        ref="video"
        class="full-width"
        autoplay
        playsinline
      />
      <canvas
        v-show="imageCaptured"
        ref="canvas"
        class="full-width"
        height="240"
      />
    </div>
    <div class="text-center q-pa-md">
      <q-btn
        v-if="hasCameraSupport"
        @click="captureImage"
        round
        color="grey-10"
        icon="eva-camera"
        size="lg"
      />
      <q-file
        v-else
        v-model="imageUpload"
        @update:model-value="captureImageFallback"
        label="Choose an image"
        accept="image/*"
        outlined
      >
        <template v-slot:prepend>
          <q-icon name="eva-attach-outline" />
        </template>
      </q-file>
      <div class="row justify-center q-ma-md">
        <q-input
          v-model="postData.caption"
          label="Caption"
          class="col col-sm-6"
          dense
        />
      </div>
      <div class="row justify-center q-ma-md">
        <q-input
          v-model="postData.location"
          label="Location"
          class="col col-sm-6"
          dense
        >
          <template v-slot:append>
            <q-btn round dense flat icon="eva-navigation-2-outline" />
          </template>
        </q-input>
      </div>
      <div class="row justify-center q-mt-lg">
        <q-btn unelevated rounded color="primary" label="Post Image" />
      </div>
    </div>
  </q-page>
</template>

<style lang="sass">
.camera-frame
  border: 2px solid $grey-10
  border-radius: 10px
</style>
