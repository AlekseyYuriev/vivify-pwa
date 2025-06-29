/**
 * dependencies
 */
const express = require('express');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const busboy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs');
const UUID = require('uuid-v4');
const webpush = require('web-push');
require('dotenv').config();

/**
 * config - express
 */
const app = express();

/**
 * config - firebase
 */
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.STORAGE_BUCKET,
});

const db = getFirestore();
const bucket = getStorage().bucket();

/**
 * config - webpush
 */

webpush.setVapidDetails(
  'mailto:test@test.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * endpoint - posts
 */
app.get('/posts', (request, response) => {
  response.set('Access-Control-Allow-Origin', '*');

  let posts = [];
  db.collection('posts')
    .orderBy('date', 'desc')
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        posts.push(doc.data());
      });
      response.send(posts);
    });
});

/**
 * endpoint - createPost
 */
app.post('/createPost', (request, response) => {
  response.set('Access-Control-Allow-Origin', '*');

  let uuid = UUID();

  const bb = busboy({ headers: request.headers });

  let fields = {};
  let fileData = {};

  bb.on('file', (name, file, info) => {
    const { filename, encoding, mimetype } = info;
    let filepath = path.join(os.tmpdir(), `${filename}`);
    file.pipe(fs.createWriteStream(filepath));
    fileData = { filepath, mimetype };
  });

  bb.on('field', (name, val, info) => {
    fields[name] = val;
  });

  bb.on('close', () => {
    bucket.upload(
      fileData.filepath,
      {
        uploadType: 'media',
        metadata: {
          metadata: {
            contentType: fileData.mimetype,
            firebaseStorageDownloadTokens: uuid,
          },
        },
      },
      (err, uploadedFile) => {
        if (!err) {
          createDocument(uploadedFile);
        }
      }
    );

    function createDocument(uploadedFile) {
      db.collection('posts')
        .doc(fields.id)
        .set({
          id: fields.id,
          caption: fields.caption,
          location: fields.location,
          date: parseInt(fields.date),
          imageUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${uploadedFile.name}?alt=media&token=${uuid}`,
        })
        .then(() => {
          sendPushNotification();
          response.send('Post added: ' + fields.id);
        });
    }

    function sendPushNotification() {
      let subscriptions = [];
      db.collection('subscriptions')
        .get()
        .then((snapshot) => {
          snapshot.forEach((doc) => {
            subscriptions.push(doc.data());
          });
          return subscriptions;
        })
        .then((subscriptions) => {
          subscriptions.forEach((subscription) => {
            const pushSubscription = {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscription['keys[auth]'] || subscription.keys?.auth,
                p256dh:
                  subscription['keys[p256dh]'] || subscription.keys?.p256dh,
              },
            };

            let pushContent = {
              title: 'New Vivify Post!',
              body: 'A new post has been added! Check it out!',
              openUrl: '/',
            };

            let payload = JSON.stringify(pushContent);

            webpush
              .sendNotification(pushSubscription, payload)
              .then(() => {
                console.log('Push notification sent successfully');
              })
              .catch((error) => {
                console.log('Push notification failed:', error);

                // If subscription is expired/invalid (410), remove it from database
                if (error.statusCode === 410) {
                  // Remove the expired subscription from Firestore
                  db.collection('subscriptions')
                    .where('endpoint', '==', subscription.endpoint)
                    .get()
                    .then((snapshot) => {
                      snapshot.forEach((doc) => {
                        doc.ref.delete().then(() => {
                          console.log(
                            'Expired subscription removed from database'
                          );
                        });
                      });
                    });
                }
              });
          });
        });
    }
  });
  request.pipe(bb);
});

/**
 * endpoint - createSubscription
 */
app.post('/createSubscription', (request, response) => {
  response.set('Access-Control-Allow-Origin', '*');

  const subscriptionData = request.query;

  // Check if subscription already exists
  db.collection('subscriptions')
    .where('endpoint', '==', subscriptionData.endpoint)
    .get()
    .then((snapshot) => {
      if (snapshot.empty) {
        // Add new subscription
        return db.collection('subscriptions').add(subscriptionData);
      } else {
        // Update existing subscription
        const doc = snapshot.docs[0];
        return doc.ref.update(subscriptionData);
      }
    })
    .then((docRef) => {
      response.send({
        message: 'Subscription saved successfully',
        postData: subscriptionData,
      });
    })
    .catch((error) => {
      console.error('Error saving subscription:', error);
      response.status(500).send({ error: 'Failed to save subscription' });
    });
});

/**
 * listen
 */
app.listen(process.env.PORT || 3000);
