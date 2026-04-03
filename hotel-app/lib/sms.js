// import { supabase } from '@/lib/supabaseClient';
// 
// /**
//  * Validates a phone number string.
//  * Strips non-digit characters and checks for 10-15 digits.
//  * @param {string} phone
//  * @returns {{ valid: boolean, cleaned: string }}
//  */
// function validatePhone(phone) {
//   if (!phone || typeof phone !== 'string') return { valid: false, cleaned: '' };
//   const cleaned = phone.replace(/\D/g, '');
//   return { valid: cleaned.length >= 10 && cleaned.length <= 15, cleaned };
// }
// 
// /**
//  * Logs an SMS event to the sms_logs table.
//  * Fire-and-forget — does not throw.
//  */
// async function logSMS({ task_id, task_code, event_type, status, phone, message, raw_payload }) {
//   try {
//     await supabase.from('sms_logs').insert({
//       task_id: task_id || null,
//       task_code: task_code || null,
//       event_type,
//       status,
//       phone: phone || null,
//       message: message || null,
//       raw_payload: raw_payload || null,
//     });
//   } catch (err) {
//     console.error('[SMS] Failed to write sms_log:', err.message);
//   }
// }
// 
// /**
//  * Sends an SMS to a staff member via MSG91 Flow API.
//  *
//  * @param {string} to - Staff phone number
//  * @param {object} taskDetails
//  * @param {number}  taskDetails.task_id
//  * @param {string}  taskDetails.task_code  e.g. "T142"
//  * @param {string}  taskDetails.staff_name e.g. "Ramesh"
//  * @param {string}  taskDetails.room       e.g. "204"
//  * @param {string}  taskDetails.task_type  e.g. "Towels Required"
//  * @param {string}  taskDetails.time       e.g. "7:05 PM"
//  *
//  * @returns {{ success: boolean, error?: string }}
//  */
// export async function sendSMS(to, taskDetails) {
//   const { task_id, task_code, staff_name, room, task_type, time } = taskDetails;
// 
//   const AUTH_KEY = process.env.MSG91_AUTH_KEY;
//   const FLOW_ID  = process.env.MSG91_FLOW_ID;
//   const SENDER   = process.env.MSG91_SENDER_ID || 'HTLSMS';
// 
//   // ── Phone validation ──────────────────────────────────────
//   const { valid, cleaned: cleanedPhone } = validatePhone(to);
//   if (!valid) {
//     const errMsg = `Invalid phone number: "${to}"`;
//     console.error('[SMS]', errMsg);
//     await logSMS({
//       task_id,
//       task_code,
//       event_type: 'error',
//       status: 'failed',
//       phone: to,
//       message: errMsg,
//     });
//     return { success: false, error: errMsg };
//   }
// 
//   // ── MSG91 credentials check ───────────────────────────────
//   if (!AUTH_KEY || !FLOW_ID) {
//     const errMsg = 'MSG91_AUTH_KEY or MSG91_FLOW_ID not configured';
//     console.warn('[SMS]', errMsg);
//     await logSMS({
//       task_id,
//       task_code,
//       event_type: 'error',
//       status: 'failed',
//       phone: cleanedPhone,
//       message: errMsg,
//     });
//     return { success: false, error: errMsg };
//   }
// 
//   // ── Build MSG91 Flow payload ──────────────────────────────
//   const payload = {
//     flow_id: FLOW_ID,
//     sender:  SENDER,
//     mobiles: `91${cleanedPhone}`,          // India prefix; adjust if multi-country
//     VAR1:    staff_name,
//     VAR2:    room,
//     VAR3:    task_type,
//     VAR4:    time,
//     VAR5:    task_code,
//   };
// 
//   // ── SMS message body logged locally ──────────────────────
//   const smsBody =
//     `HOTEL TASK\n${staff_name}\nRoom ${room}\n${task_type}\n${time}\n\nComplete:\n${task_code}`;
// 
//   try {
//     const resp = await fetch('https://api.msg91.com/api/v5/flow/', {
//       method:  'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         authkey: AUTH_KEY,
//       },
//       body: JSON.stringify(payload),
//     });
// 
//     const respData = await resp.json().catch(() => ({}));
// 
//     if (!resp.ok || respData.type === 'error') {
//       const errMsg = respData.message || `MSG91 HTTP ${resp.status}`;
//       console.error('[SMS] MSG91 error:', errMsg);
//       await logSMS({
//         task_id,
//         task_code,
//         event_type: 'error',
//         status: 'failed',
//         phone: cleanedPhone,
//         message: smsBody,
//         raw_payload: respData,
//       });
//       return { success: false, error: errMsg };
//     }
// 
//     console.log(`[SMS] Sent to ${cleanedPhone} for task ${task_code}`);
//     await logSMS({
//       task_id,
//       task_code,
//       event_type: 'sent',
//       status: 'sent',
//       phone: cleanedPhone,
//       message: smsBody,
//       raw_payload: respData,
//     });
//     return { success: true };
// 
//   } catch (err) {
//     console.error('[SMS] Network/fetch error:', err.message);
//     await logSMS({
//       task_id,
//       task_code,
//       event_type: 'error',
//       status: 'failed',
//       phone: cleanedPhone,
//       message: smsBody,
//       raw_payload: { error: err.message },
//     });
//     return { success: false, error: err.message };
//   }
// }

import { supabase } from "@/lib/supabaseClient";

/** Logs an SMS event to the sms_logs table. */
async function logSMS(log) {
  try {
    await supabase.from("sms_logs").insert(log);
  } catch (err) {
    console.error("[SMS] Failed to write sms_log:", err.message);
  }
}

import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendSMS(to, taskDetails) {
  const { task_id, task_code, staff_name, room, task_type, time, assigned_staff_name, supervisor_name, notes } = taskDetails;

  // ── FIX 1: Phone validation guard — must run BEFORE any string operations ──
  // Prevents TypeError crash if `to` is null/undefined/non-string (e.g. DB returns null).
  // Without this guard, .length and .startsWith() below throw before the try/catch,
  // silently bypassing all SMS logging.
  if (!to || typeof to !== 'string' || to.trim() === '' || to === 'N/A') {
    const errMsg = `[SMS] sendSMS called with invalid phone: "${to}" (task: ${task_code ?? 'unknown'})`;
    console.error(errMsg);
    await logSMS({
      task_id:    task_id    ?? null,
      task_code:  task_code  ?? null,
      event_type: 'error',
      status:     'failed',
      phone:      String(to ?? ''),
      message:    errMsg,
    });
    return { success: false, error: errMsg };
  }

  let targetPhone = to.trim();
  // Basic E.164 formatting fallback for India
  const digits = targetPhone.replace(/\D/g, '');
  if (digits.length === 10) targetPhone = `+91${digits}`;
  else if (digits.length === 12 && digits.startsWith('91')) targetPhone = `+${digits}`;
  else if (!targetPhone.startsWith('+')) targetPhone = `+${digits}`;

  let alertDetails = `Attn: ${staff_name}\nRoom: ${room}\nTask: ${task_type}`;
  if (notes) alertDetails += `\nRequirement: ${notes}`;
  alertDetails += `\nTime: ${time}`;

  if (assigned_staff_name) alertDetails += `\nStaff: ${assigned_staff_name}`;
  if (supervisor_name) alertDetails += `\nSupervisor: ${supervisor_name}`;

  // V2: multi-command reply instructions
  const body = `HOTEL TASK ALERT\n\n${alertDetails}\n\nReply:\nOK ${task_code} — Acknowledge\nSTART ${task_code} — Begin Work\nDONE ${task_code} — Mark Complete`;

  try {
    const res = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: targetPhone,
    });

    await logSMS({
      task_id, task_code,
      event_type: 'sent', status: 'sent',
      phone: targetPhone, message: body,
      raw_payload: res
    });

    console.log(`[SMS] Sent to ${targetPhone} for task ${task_code}`);
    return { success: true };
  } catch (err) {
    console.error("Twilio SMS Error:", err.message);
    await logSMS({
      task_id, task_code,
      event_type: 'error', status: 'failed',
      phone: targetPhone, message: body,
      raw_payload: { error: err.message }
    });
    return { success: false, error: err.message };
  }
}