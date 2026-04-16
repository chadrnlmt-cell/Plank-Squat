// public/firebase-messaging-sw.js
// Firebase Cloud Messaging service worker — required for background push notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD8kDlREA7WEENXQQSDFjtdkjCEaQYaGdQ",
  authDomain: "plank-and-squat.firebaseapp.com",
  projectId: "plank-and-squat",
  storageBucket: "plank-and-squat.firebasestorage.app",
  messagingSenderId: "586593177213",
  appId: "1:586593177213:web:acf54189c464b71850eb14",
});

const messaging = firebase.messaging();

// Handle background messages (app is closed or in background)
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'Plank & Squat Challenge', {
    body: body || "Time to crush today's challenge! 💪",
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    data: payload.data || {},
  });
});

// When user taps notification, open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
