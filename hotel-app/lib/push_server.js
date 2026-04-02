import admin from 'firebase-admin';
import { supabase } from './supabaseClient';
import { sendSMS } from './sms';

/**
 * PRODUCTION-READY FCM SETUP
 * Requires these ENV variables:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY
 */
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Handling for both local and hosted environments
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('[FCM Admin API] Initialization failed:', error.message);
  }
}

const messaging = admin.messaging();

/**
 * PRODUCTION NOTIFICATION ENGINE
 * Logic:
 * 1. Anti-Spam check (last_seen < 2 mins ago)
 * 2. Send Push via FCM Multicast (to all staff devices)
 * 3. 30s Fail-Safe: Check for Acknowledge on Task
 * 4. Fallback: Send SMS via existing Twilio/MSG91 logic
 */
export async function notifyStaffWithFallback(toPhone, staffId, task, eventType) {
  const staffName = task.staff?.name || task.assigned_staff?.name || 'Staff';
  const roomNum   = task.rooms?.room_number || '?';

  try {
    // ── 1. ANTI-SPAM LOGIC ──────────────────────────────────
    // Don't send push if user was active in the app within last 2 minutes
    const { data: staff } = await supabase
      .from('staff')
      .select('last_seen')
      .eq('id', staffId)
      .single();
    
    const now = Date.now();
    const lastSeen = staff?.last_seen ? new Date(staff.last_seen).getTime() : 0;
    const isUserActive = (now - lastSeen) < 120000; // 2 minutes

    if (!isUserActive) {
      // ── 2. FCM PUSH LOGIC ─────────────────────────────────
      const { data: devices } = await supabase
        .from('staff_devices')
        .select('fcm_token')
        .eq('staff_id', staffId);

      if (devices && devices.length > 0) {
        const tokens = devices.map(d => d.fcm_token);
        const payload = {
          notification: {
            title: eventType === 'escalated' ? '🔴 Priority Alert' : '🔔 New Task Assigned',
            body: `Room ${roomNum}: ${task.task_type}`,
          },
          data: {
            taskId: String(task.id),
            taskCode: task.task_code,
            type: eventType
          },
          tokens
        };

        const response = await messaging.sendEachForMulticast(payload);
        console.log(`[Push Server] Sent to ${response.successCount} devices for staff ${staffId}`);
        
        // Clean up stale tokens
        if (response.failureCount > 0) {
          response.responses.forEach(async (resp, idx) => {
            if (!resp.success && (resp.error.code === 'messaging/registration-token-not-registered' || resp.error.code === 'messaging/invalid-registration-token')) {
              await supabase.from('staff_devices').delete().eq('fcm_token', tokens[idx]);
            }
          });
        }
      }
    }

    // ── 3. FAIL-SAFE FALLBACK (30s Delay) ────────────────────
    // If no acknowledgement in 30 seconds, send SMS.
    // In serverless environments (Vercel), we recommend using a 
    // separate worker or cron, but for this implementation we simulate
    // with a deferred check if your environment supports prolonged processes.
    setTimeout(async () => {
      try {
        const { data: currentTask } = await supabase
          .from('tasks')
          .select('status, acknowledged_at')
          .eq('id', task.id)
          .single();
        
        // Final sanity check before firing SMS
        const isCompleted = currentTask?.status === 'completed';
        const isAcked     = currentTask?.status !== 'pending' || !!currentTask?.acknowledged_at;
        
        if (!isAcked && !isCompleted) {
          console.warn(`[Fail-Safe] Task ${task.task_code} NOT ACKNOWLEDGED after 30s. Triggering SMS Fallback.`);
          await sendSMS(toPhone, {
            ...task,
            staff_name: staffName,
            room: roomNum,
            time: new Date().toLocaleTimeString(),
          });
        }
      } catch (e) {
        console.error('[Fail-Safe] Error in timeout check:', e.message);
      }
    }, 30000);

  } catch (err) {
    console.error('[Push Admin] Critical Failure:', err.message);
    // On Push failure, fire SMS immediately to ensure guest service isn't delayed
    await sendSMS(toPhone, {
       ...task,
       staff_name: staffName,
       room: roomNum,
       time: new Date().toLocaleTimeString(),
    });
  }
}
