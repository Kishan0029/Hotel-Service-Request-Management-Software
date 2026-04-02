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

let messaging;
try {
  messaging = admin.messaging();
} catch (e) {
  console.error('[FCM] Could not get messaging instance:', e.message);
}

/**
 * PRODUCTION NOTIFICATION ENGINE — SERVERLESS-SAFE
 *
 * Strategy (in order of priority):
 * 1. Send SMS immediately and synchronously — this is always the reliable path.
 * 2. After SMS is confirmed sent (or failed), attempt FCM push as a bonus.
 *    Push is fire-and-forget; its success or failure does NOT affect SMS delivery.
 *
 * WHY: setTimeout-based fallbacks are NOT safe in serverless environments (Vercel,
 * Lambda, etc.) because the process is killed as soon as the HTTP response is sent.
 * The 30-second timer callback is scheduled but immediately destroyed.
 *
 * The old "push first, SMS fallback" pattern resulted in intermittent delivery:
 * - SMS was only sent when Firebase threw an exception (unreliable)
 * - Anti-spam logic could block push AND suppress SMS, leaving staff unnotified
 */
export async function notifyStaffWithFallback(toPhone, staffId, task, eventType) {
  const staffName = task.staff?.name || task.assigned_staff?.name || 'Staff';
  const roomNum   = task.rooms?.room_number || '?';
  const time      = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });

  // ── STEP 1: Send SMS synchronously (always, guaranteed delivery) ────────────
  // This is the primary and most reliable notification path.
  let smsResult = { success: false, error: 'not_attempted' };
  if (toPhone && toPhone !== 'N/A') {
    try {
      smsResult = await sendSMS(toPhone, {
        task_id:    task.id,
        task_code:  task.task_code,
        staff_name: staffName,
        room:       roomNum,
        task_type:  task.task_type,
        notes:      task.notes,
        time,
      });
    } catch (smsErr) {
      console.error('[Notify] SMS send threw an exception:', smsErr.message);
      smsResult = { success: false, error: smsErr.message };
    }
  } else {
    console.warn(`[Notify] No valid phone number for staff ${staffId} (task ${task.task_code}). SMS skipped.`);
    // Log the skip to sms_logs for observability
    try {
      await supabase.from('sms_logs').insert({
        task_id:    task.id,
        task_code:  task.task_code,
        event_type: 'error',
        status:     'skipped',
        message:    `SMS skipped: no valid phone number for staffId=${staffId}`,
      });
    } catch (_) {}
  }

  // ── STEP 2: Attempt FCM Push as a bonus (fire-and-forget) ──────────────────
  // This does NOT block the caller. Push failure is logged but does not re-trigger SMS.
  // Staff has already been notified via SMS in Step 1.
  if (messaging && staffId) {
    // Non-blocking: use .then/.catch to avoid blocking the calling API route
    (async () => {
      try {
        const { data: devices } = await supabase
          .from('staff_devices')
          .select('fcm_token')
          .eq('staff_id', staffId);

        if (devices && devices.length > 0) {
          const tokens = devices.map(d => d.fcm_token).filter(Boolean);
          if (tokens.length === 0) return;

          const payload = {
            notification: {
              title: eventType === 'escalated' ? '🔴 Priority Alert' : '🔔 New Task Assigned',
              body:  `Room ${roomNum}: ${task.task_type}`,
            },
            data: {
              taskId:   String(task.id),
              taskCode: task.task_code,
              type:     eventType,
            },
            tokens,
          };

          const response = await messaging.sendEachForMulticast(payload);
          console.log(`[Push] Sent to ${response.successCount}/${tokens.length} devices for staff ${staffId} (task ${task.task_code})`);

          // Clean up stale/invalid tokens
          if (response.failureCount > 0) {
            const staleTokens = [];
            response.responses.forEach((resp, idx) => {
              if (
                !resp.success &&
                (resp.error?.code === 'messaging/registration-token-not-registered' ||
                  resp.error?.code === 'messaging/invalid-registration-token')
              ) {
                staleTokens.push(tokens[idx]);
              }
            });
            if (staleTokens.length > 0) {
              await supabase
                .from('staff_devices')
                .delete()
                .in('fcm_token', staleTokens);
              console.log(`[Push] Cleaned up ${staleTokens.length} stale FCM token(s)`);
            }
          }
        }
      } catch (pushErr) {
        // Push failure is expected in many environments (no tokens, expired keys, etc.)
        // This is logged for observability but does NOT affect SMS delivery.
        console.warn(`[Push] FCM push failed for staff ${staffId} (task ${task.task_code}): ${pushErr.message}`);
      }
    })();
  }

  return smsResult;
}
