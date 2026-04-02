importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js');

// REPLACE with actual Firebase Config found in your project settings
firebase.initializeApp({
  apiKey: "AIzaSyCddoppBj0VC5m6erF1tDFmRI6lVvjKLqI",
  authDomain: "regenta-management-system.firebaseapp.com",
  projectId: "regenta-management-system",
  storageBucket: "regenta-management-system.firebasestorage.app",
  messagingSenderId: "1092716796377",
  appId: "1:1092716796377:web:e52f4dedf9c253d7e3a1c8",
  measurementId: "G-E36KDVFLST"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body, data } = payload.notification || payload.data;
  const taskId = data?.taskId;

  const notificationTitle = title || 'Task Alert';
  const notificationOptions = {
    body: body || 'You have a new update.',
    icon: '/images/og-image.png',
    data: { url: taskId ? `/tasks/${taskId}` : '/staff' } // Correct for staff dashboard
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
