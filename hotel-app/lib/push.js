import { initializeApp, getApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// REPLACE with actual Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCddoppBj0VC5m6erF1tDFmRI6lVvjKLqI",
  authDomain: "regenta-management-system.firebaseapp.com",
  projectId: "regenta-management-system",
  storageBucket: "regenta-management-system.firebasestorage.app",
  messagingSenderId: "1092716796377",
  appId: "1:1092716796377:web:e52f4dedf9c253d7e3a1c8",
  measurementId: "G-E36KDVFLST"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

// VAPID KEY found in FCM project settings
const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

/** 
 * Registers staff FCM token with the backend. 
 * Allows multiple devices per staff (Mobile + Desktop).
 */
export async function setupPushNotifications(staffId) {
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return console.warn('Push permission denied.');

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return console.warn('Failed to retrieve FCM token.');

    // Update backend
    await fetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_API_KEY },
      body: JSON.stringify({ staffId, token }),
    });

    // Listen for foreground messages
    onMessage(messaging, (payload) => {
      console.log('Foreground message:', payload);
      // Optional: use toast to show notification while in-app
    });

    // Track active status for anti-spam
    trackStaffActivity(staffId);
  } catch (err) {
    console.error('FCM Setup failed:', err);
  }
}

/** 
 * Updates last_active to suppress push notifications while user is in-app.
 */
function trackStaffActivity(staffId) {
  const update = () => {
    fetch('/api/push/active', { 
      method: 'POST', 
      headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY },
      body: JSON.stringify({ staffId }) 
    });
  };
  
  // Update every 3 minutes if active
  setInterval(update, 180000);
  update();
}
