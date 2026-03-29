import { supabase } from '@/lib/supabaseClient';

/**
 * POST /api/sms-reply
 *
 * Receives incoming SMS replies from Twilio / MSG91.
 * Parses the command and maps it to the correct status transition.
 *
 * Accepted formats:
 *   OK T123    → acknowledged
 *   START T123 → in_progress
 *   DONE T123  → completed
 *   T123       → completed  (backwards compat — bare task code)
 *   123        → completed  (backwards compat — bare number)
 *
 * ALWAYS returns HTTP 200 — providers retry on any non-200 response.
 */
export async function POST(request) {
  let rawBody = null;

  try {
    // ── Parse body ————————————————————————————————————————————
    const contentType = request.headers.get('content-type') || '';
    let message = '';

    if (contentType.includes('application/json')) {
      rawBody = await request.json();
      message = rawBody?.message ?? rawBody?.text ?? rawBody?.Message ?? '';
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      rawBody = Object.fromEntries(new URLSearchParams(text));
      message = rawBody?.message ?? rawBody?.text ?? rawBody?.Message ?? '';
    } else {
      const text = await request.text();
      try {
        rawBody = JSON.parse(text);
        message = rawBody?.message ?? rawBody?.text ?? rawBody?.Message ?? '';
      } catch {
        message = text;
        rawBody = { raw: text };
      }
    }

    // ── Normalize ─────────────────────────────────────────────
    const normalized = String(message).toUpperCase().trim();
    console.log(`[SMS Webhook] Received: "${normalized}"`);

    // ── Parse command + task code ──────────────────────────────
    // Patterns:
    //   OK T123  →  command=OK, taskId=123
    //   START T123 →  command=START, taskId=123
    //   DONE T123  →  command=DONE, taskId=123
    //   T123 / 123 →  command=null (bare code → completed)
    let command = null;
    let taskId  = null;

    const fullMatch = normalized.match(/^(OK|START|DONE)\s+T?(\d+)/);
    const bareMatch = normalized.match(/^T?(\d+)/);

    if (fullMatch) {
      command = fullMatch[1];  // OK | START | DONE
      taskId  = parseInt(fullMatch[2], 10);
    } else if (bareMatch) {
      command = null;           // bare code → completed (backwards compat)
      taskId  = parseInt(bareMatch[1], 10);
    } else {
      await logReceived({
        task_id: null, task_code: null,
        status: 'failed',
        phone: rawBody?.mobile || rawBody?.sender || rawBody?.From || null,
        message: normalized,
        raw_payload: rawBody,
        note: 'Could not parse command or task ID from message',
      });
      return Response.json({ success: false, reason: 'invalid_message' }, { status: 200 });
    }

    // ── Map command → new status ──────────────────────────────
    const STATUS_MAP = {
      OK:    'acknowledged',
      START: 'in_progress',
      DONE:  'completed',
      null:  'completed',     // bare code fallback
    };
    const newStatus = STATUS_MAP[command];
    const task_code = `T${taskId}`;

    // ── Look up the task ──────────────────────────────────────
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('id, task_code, status, current_level')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) {
      await logReceived({
        task_id: taskId, task_code,
        status: 'failed',
        phone: rawBody?.mobile || rawBody?.sender || rawBody?.From || null,
        message: normalized,
        raw_payload: rawBody,
        note: `Task not found: ${taskId}`,
      });
      return Response.json({ success: false, reason: 'task_not_found' }, { status: 200 });
    }

    // ── V4: Block SMS commands if task is not yet at staff level ─────────────
    if (task.current_level && task.current_level !== 'staff') {
      const note = `Task ${task_code} is at '${task.current_level}' level — SMS replies only accepted at staff level`;
      console.warn(`[SMS Webhook] ${note}`);
      await logReceived({
        task_id: taskId, task_code: task.task_code,
        status: 'failed',
        phone: rawBody?.mobile || rawBody?.sender || rawBody?.From || null,
        message: normalized,
        raw_payload: rawBody,
        note,
      });
      return Response.json({ success: false, reason: 'not_at_staff_level', note }, { status: 200 });
    }

    // ── Idempotency: already at or past target status ─────────
    const ORDER = ['pending', 'acknowledged', 'in_progress', 'completed'];
    const currentIdx = ORDER.indexOf(task.status);
    const targetIdx  = ORDER.indexOf(newStatus);

    if (currentIdx >= targetIdx) {
      console.log(`[SMS Webhook] Task ${task_code} already at '${task.status}' — ignoring '${command ?? 'bare'}'`);
      await logReceived({
        task_id: taskId, task_code: task.task_code,
        status: 'sent',
        phone: rawBody?.mobile || rawBody?.sender || rawBody?.From || null,
        message: normalized,
        raw_payload: rawBody,
        note: `Already at '${task.status}' — idempotent ignore`,
      });
      return Response.json({ success: true, already_at_status: task.status }, { status: 200 });
    }

    // ── Validate forward transition ───────────────────────────
    const VALID_TRANSITIONS = {
      pending:      ['acknowledged'],
      acknowledged: ['in_progress'],
      in_progress:  ['completed'],
    };
    const allowed = VALID_TRANSITIONS[task.status] ?? [];
    if (!allowed.includes(newStatus)) {
      const note = `Invalid transition: ${task.status} → ${newStatus}`;
      console.warn(`[SMS Webhook] ${note} for task ${task_code}`);
      await logReceived({
        task_id: taskId, task_code: task.task_code,
        status: 'failed',
        phone: rawBody?.mobile || rawBody?.sender || rawBody?.From || null,
        message: normalized,
        raw_payload: rawBody,
        note,
      });
      return Response.json({ success: false, reason: 'invalid_transition', note }, { status: 200 });
    }

    // ── Apply update ──────────────────────────────────────────
    const updatePayload = { status: newStatus };
    if (newStatus === 'completed') {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', taskId);

    if (updateError) {
      console.error('[SMS Webhook] Update error:', updateError.message);
      await logReceived({
        task_id: taskId, task_code: task.task_code,
        status: 'failed',
        phone: rawBody?.mobile || rawBody?.sender || rawBody?.From || null,
        message: normalized,
        raw_payload: rawBody,
        note: `DB update failed: ${updateError.message}`,
      });
      return Response.json({ success: false, reason: 'db_error' }, { status: 200 });
    }

    console.log(`[SMS Webhook] Task ${task_code}: ${task.status} → ${newStatus} (cmd: ${command ?? 'bare'})`);
    await logReceived({
      task_id: taskId, task_code: task.task_code,
      status: 'sent',
      phone: rawBody?.mobile || rawBody?.sender || rawBody?.From || null,
      message: normalized,
      raw_payload: rawBody,
    });

    return Response.json({ success: true, task_id: taskId, task_code, new_status: newStatus }, { status: 200 });

  } catch (err) {
    console.error('[SMS Webhook] Unexpected error:', err.message);
    try {
      await supabase.from('sms_logs').insert({
        event_type: 'error',
        status: 'failed',
        message: err.message,
        raw_payload: rawBody,
      });
    } catch { /* swallow */ }
    return Response.json({ success: false, reason: 'internal_error' }, { status: 200 });
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────
async function logReceived({ task_id, task_code, status, phone, message, raw_payload, note }) {
  try {
    await supabase.from('sms_logs').insert({
      task_id:     task_id || null,
      task_code:   task_code || null,
      event_type:  'received',
      status,
      phone:       phone || null,
      message:     note ? `${message} [${note}]` : message,
      raw_payload: raw_payload || null,
    });
  } catch (e) {
    console.error('[SMS Webhook] Failed to write log:', e.message);
  }
}
