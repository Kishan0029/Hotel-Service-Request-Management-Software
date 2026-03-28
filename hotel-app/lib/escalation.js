import { supabase } from '@/lib/supabaseClient';
import { sendSMS } from '@/lib/sms';

const L1_MINUTES = parseInt(process.env.ESCALATION_L1_MINUTES ?? '10', 10);
const L2_MINUTES = parseInt(process.env.ESCALATION_L2_MINUTES ?? '15', 10);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Write a row to sms_logs for escalation events. */
async function logEscalation({ task_id, task_code, status, phone, message, raw_payload }) {
  try {
    await supabase.from('sms_logs').insert({
      task_id:     task_id  ?? null,
      task_code:   task_code ?? null,
      event_type:  'escalation',
      status,
      phone:       phone ?? null,
      message,
      raw_payload: raw_payload ?? null,
    });
  } catch (err) {
    console.error('[Escalation] Failed to write sms_log:', err.message);
  }
}

/** Find the first active staff member with the given role in a department. */
async function findStaff(department_id, role) {
  const { data, error } = await supabase
    .from('staff')
    .select('id, name, phone_number')
    .eq('department_id', department_id)
    .eq('role', role)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

/** Basic phone sanity check. */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// ─────────────────────────────────────────────────────────────────────────────
// Escalate a single task to level 1 (supervisor)
// ─────────────────────────────────────────────────────────────────────────────
async function escalateToSupervisor(task, elapsedMinutes) {
  const { id: task_id, task_code, department_id, rooms } = task;
  const room = rooms?.room_number ?? '?';

  const supervisor = await findStaff(department_id, 'supervisor');
  if (!supervisor) {
    console.warn(`[Escalation] No active supervisor for dept ${department_id} (task ${task_code})`);
    return;
  }
  if (!isValidPhone(supervisor.phone_number)) {
    console.warn(`[Escalation] Supervisor ${supervisor.name} has invalid phone (task ${task_code})`);
    return;
  }

  // Atomically update — only succeeds if escalation_level is still 0
  const { data: updated, error: updateError } = await supabase
    .from('tasks')
    .update({ escalation_level: 1, escalated_at: new Date().toISOString() })
    .eq('id', task_id)
    .eq('escalation_level', 0)
    .select('id');

  if (updateError) {
    console.error(`[Escalation] DB Update failed for L1 task ${task_code}:`, updateError.message);
    return;
  }
  if (!updated || updated.length === 0) return; // another process beat us

  const result = await sendSMS(supervisor.phone_number, {
    task_id, task_code,
    staff_name:          supervisor.name,
    assigned_staff_name: task.staff?.name,
    room,
    task_type: task.task_type,
    notes:     task.notes,
    time:      `${Math.round(elapsedMinutes)} mins`,
  });

  await logEscalation({
    task_id, task_code,
    status:      result.success ? 'sent' : 'failed',
    phone:       supervisor.phone_number,
    message:     'level_1_timeout',
    raw_payload: { elapsed_minutes: Math.round(elapsedMinutes), escalated_to: supervisor.name },
  });

  console.log(`[Escalation] L1 — task ${task_code} escalated to supervisor ${supervisor.name}`);
  return { task_id, task_code, level: 1, escalated_to: supervisor.name };
}

// ─────────────────────────────────────────────────────────────────────────────
// Escalate a single task to level 2 (manager)
// ─────────────────────────────────────────────────────────────────────────────
async function escalateToManager(task, elapsedMinutes) {
  const { id: task_id, task_code, department_id, rooms } = task;
  const room = rooms?.room_number ?? '?';

  const manager = await findStaff(department_id, 'manager');
  if (!manager) {
    console.warn(`[Escalation] No active manager for dept ${department_id} (task ${task_code})`);
    return;
  }
  if (!isValidPhone(manager.phone_number)) {
    console.warn(`[Escalation] Manager ${manager.name} has invalid phone (task ${task_code})`);
    return;
  }

  // Atomically update — only succeeds if escalation_level is still 1
  const { data: updated, error: updateError } = await supabase
    .from('tasks')
    .update({ escalation_level: 2, escalated_at: new Date().toISOString() })
    .eq('id', task_id)
    .eq('escalation_level', 1)
    .select('id');

  if (updateError) {
    console.error(`[Escalation] DB Update failed for L2 task ${task_code}:`, updateError.message);
    return;
  }
  if (!updated || updated.length === 0) return;

  const supervisor = await findStaff(department_id, 'supervisor');

  const result = await sendSMS(manager.phone_number, {
    task_id, task_code,
    staff_name:          manager.name,
    assigned_staff_name: task.staff?.name,
    supervisor_name:     supervisor?.name,
    room,
    task_type: task.task_type,
    notes:     task.notes,
    time:      `${Math.round(elapsedMinutes)} mins`,
  });

  await logEscalation({
    task_id, task_code,
    status:      result.success ? 'sent' : 'failed',
    phone:       manager.phone_number,
    message:     'level_2_timeout',
    raw_payload: { elapsed_minutes: Math.round(elapsedMinutes), escalated_to: manager.name },
  });

  console.log(`[Escalation] L2 — task ${task_code} escalated to manager ${manager.name}`);
  return { task_id, task_code, level: 2, escalated_to: manager.name };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export: auto-escalation check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks all non-completed tasks and escalates those past their time thresholds.
 * Escalation is based purely on created_at — status (acknowledged / in_progress)
 * does NOT pause or reset the escalation clock.
 *
 * @returns {Promise<Array>} List of tasks escalated this call.
 */
export async function checkAndEscalate() {
  try {
    const now = Date.now();

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        id,
        task_code,
        task_type,
        status,
        created_at,
        escalation_level,
        department_id,
        notes,
        rooms (room_number),
        staff!assigned_staff_id (name)
      `)
      // ── V2 change: watch ALL non-completed statuses, not just 'pending' ──
      .in('status', ['pending', 'acknowledged', 'in_progress'])
      .in('escalation_level', [0, 1]);

    if (error) {
      console.error('[Escalation] Failed to fetch tasks:', error.message);
      return [];
    }

    const results = [];

    for (const task of tasks ?? []) {
      const elapsedMinutes = (now - new Date(task.created_at).getTime()) / 60_000;

      if (task.escalation_level === 0 && elapsedMinutes >= L1_MINUTES) {
        const r = await escalateToSupervisor(task, elapsedMinutes);
        if (r) results.push(r);
      } else if (task.escalation_level === 1 && elapsedMinutes >= L2_MINUTES) {
        const r = await escalateToManager(task, elapsedMinutes);
        if (r) results.push(r);
      }
    }

    return results;
  } catch (err) {
    console.error('[Escalation] Unexpected error in checkAndEscalate:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual force-escalation (for "Escalate Now" button)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Immediately escalates a task to the next escalation level, regardless of time.
 * Used by the PATCH /api/tasks/[id] endpoint when force_escalate=true.
 *
 * @param {{ id, task_code, status, escalation_level, department_id }} task
 * @returns {Promise<object|null>} Escalation result or null if no target found.
 */
export async function forceEscalate(task) {
  const now = Date.now();
  const elapsedMinutes = (now - new Date(task.created_at ?? now).getTime()) / 60_000;

  // Need full task data for SMS
  const { data: fullTask } = await supabase
    .from('tasks')
    .select(`
      id, task_code, task_type, notes, status, escalation_level, department_id,
      rooms (room_number),
      staff!assigned_staff_id (name)
    `)
    .eq('id', task.id)
    .single();

  if (!fullTask) return null;

  if (fullTask.escalation_level === 0) {
    return await escalateToSupervisor(fullTask, elapsedMinutes) ?? null;
  } else if (fullTask.escalation_level === 1) {
    return await escalateToManager(fullTask, elapsedMinutes) ?? null;
  }

  // Already at max escalation level
  return null;
}
