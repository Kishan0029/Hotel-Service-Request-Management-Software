import { supabase } from '@/lib/supabaseClient';
import { sendSMS } from '@/lib/sms';

const L1_MINUTES = parseInt(process.env.ESCALATION_L1_MINUTES ?? '10', 10);
const L2_MINUTES = parseInt(process.env.ESCALATION_L2_MINUTES ?? '15', 10);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// ─────────────────────────────────────────────────────────────────────────────
// V4: Escalate based on current_level
// Staff delay → notify Supervisor (L1)
// Supervisor delay → notify Manager (L2)
// Manager delay → notify GM via activity log (L2+ — GM is UI-only)
// ─────────────────────────────────────────────────────────────────────────────

async function escalateTask(task, elapsedMinutes, newLevel) {
  const { id: task_id, task_code, department_id, rooms, current_level } = task;
  const room = rooms?.room_number ?? '?';

  let targetRole;
  if (current_level === 'staff') {
    targetRole = 'supervisor'; // staff delayed → alert supervisor
  } else if (current_level === 'supervisor') {
    targetRole = 'manager';    // supervisor delayed → alert manager
  } else if (current_level === 'manager') {
    // Manager delayed → log for GM (no SMS, GM is UI-only)
    const { data: updated, error: updateError } = await supabase
      .from('tasks')
      .update({ escalation_level: newLevel, escalated_at: new Date().toISOString() })
      .eq('id', task_id)
      .eq('escalation_level', newLevel - 1)
      .select('id');

    if (updateError || !updated || updated.length === 0) return null;

    // Append to activity log for GM visibility
    const { data: t } = await supabase.from('tasks').select('activity_log').eq('id', task_id).single();
    const log = Array.isArray(t?.activity_log) ? t.activity_log : [];
    const updated_log = [...log, { event: 'escalated', by: 'System', level: newLevel, to: 'General Manager', time: new Date().toISOString() }];
    await supabase.from('tasks').update({ activity_log: JSON.stringify(updated_log) }).eq('id', task_id);

    console.log(`[Escalation] L${newLevel} — task ${task_code} escalated to GM (UI notification only)`);
    return { task_id, task_code, level: newLevel, escalated_to: 'General Manager' };
  } else {
    return null;
  }

  // ── Fallback chain: Supervisor → Manager → GM (Fix 3) ────────────────────
  let target = await findStaff(department_id, targetRole);

  if (!target && targetRole === 'supervisor') {
    // Supervisor not found in dept → try manager next
    console.warn(`[Escalation] No active supervisor for dept ${department_id} (task ${task_code}) — falling back to manager`);
    await supabase.from('sms_logs').insert({
      task_id, task_code,
      event_type: 'escalation_fallback', status: 'warning',
      message: 'supervisor_not_found_trying_manager',
      raw_payload: { department_id, task_code, escalated_to: 'manager' },
    }).catch(() => {});
    target = await findStaff(department_id, 'manager');
    if (target) targetRole = 'manager';
  }

  if (!target) {
    // No supervisor or manager available → escalate to GM via activity log
    console.warn(`[Escalation] No active staff in fallback chain for dept ${department_id} (task ${task_code}) — escalating to GM`);
    const { data: gmUpdated, error: gmErr } = await supabase
      .from('tasks')
      .update({ escalation_level: newLevel, escalated_at: new Date().toISOString() })
      .eq('id', task_id)
      .eq('escalation_level', newLevel - 1)
      .select('id');
    if (gmErr || !gmUpdated || gmUpdated.length === 0) return null;

    const { data: tg } = await supabase.from('tasks').select('activity_log').eq('id', task_id).single();
    const glog = Array.isArray(tg?.activity_log) ? tg.activity_log : [];
    const glog_updated = [...glog, { event: 'escalated', by: 'System', level: newLevel, to: 'General Manager (fallback)', time: new Date().toISOString() }];
    await supabase.from('tasks').update({ activity_log: JSON.stringify(glog_updated) }).eq('id', task_id);

    await supabase.from('sms_logs').insert({
      task_id, task_code,
      event_type: 'escalation', status: 'sent',
      message: 'gm_fallback_no_supervisor_or_manager',
      raw_payload: { department_id, escalated_to: 'gm', elapsed_minutes: Math.round(elapsedMinutes) },
    }).catch(() => {});

    console.log(`[Escalation] L${newLevel} — task ${task_code} escalated to GM (fallback — no supervisor/manager found)`);
    return { task_id, task_code, level: newLevel, escalated_to: 'gm' };
  }

  if (!isValidPhone(target.phone_number)) {
    console.warn(`[Escalation] ${targetRole} ${target.name} has invalid phone (task ${task_code})`);
    return null;
  }

  // Atomically update escalation level
  const { data: updated, error: updateError } = await supabase
    .from('tasks')
    .update({ escalation_level: newLevel, escalated_at: new Date().toISOString() })
    .eq('id', task_id)
    .eq('escalation_level', newLevel - 1)
    .select('id');

  if (updateError) {
    console.error(`[Escalation] DB Update failed for L${newLevel} task ${task_code}:`, updateError.message);
    return null;
  }
  if (!updated || updated.length === 0) return null; // already escalated by another process

  // Append to activity log
  const { data: t } = await supabase.from('tasks').select('activity_log').eq('id', task_id).single();
  const log = Array.isArray(t?.activity_log) ? t.activity_log : [];
  const updated_log = [...log, { event: 'escalated', by: 'System', level: newLevel, to: target.name, time: new Date().toISOString() }];
  await supabase.from('tasks').update({ activity_log: JSON.stringify(updated_log) }).eq('id', task_id);

  const result = await sendSMS(target.phone_number, {
    task_id, task_code,
    staff_name:          target.name,
    assigned_staff_name: task.staff?.name ?? task.assigned_staff?.name,
    room,
    task_type: task.task_type,
    notes:     task.notes,
    time:      `${Math.round(elapsedMinutes)} mins`,
  });

  await logEscalation({
    task_id, task_code,
    status:      result.success ? 'sent' : 'failed',
    phone:       target.phone_number,
    message:     `level_${newLevel}_timeout`,
    raw_payload: { elapsed_minutes: Math.round(elapsedMinutes), escalated_to: target.name, current_level },
  });

  console.log(`[Escalation] L${newLevel} — task ${task_code} (level: ${current_level}) escalated to ${targetRole} ${target.name}`);
  return { task_id, task_code, level: newLevel, escalated_to: target.name };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export: auto-escalation check
// ─────────────────────────────────────────────────────────────────────────────

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
        expected_time,
        escalation_level,
        current_level,
        department_id,
        notes,
        rooms (room_number),
        staff!assigned_staff_id (name),
        assigned_staff:staff!assigned_to (name)
      `)
      .in('status', ['pending', 'acknowledged', 'in_progress'])
      .in('escalation_level', [0, 1]);

    if (error) {
      console.error('[Escalation] Failed to fetch tasks:', error.message);
      return [];
    }

    const results = [];

    for (const task of tasks ?? []) {
      const elapsedMinutes = (now - new Date(task.created_at).getTime()) / 60_000;
      const sla = task.expected_time || 10;

      if (task.escalation_level === 0 && elapsedMinutes >= sla) {
        const r = await escalateTask(task, elapsedMinutes, 1);
        if (r) results.push(r);
      } else if (task.escalation_level === 1 && elapsedMinutes >= (sla + 2)) {
        const r = await escalateTask(task, elapsedMinutes, 2);
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
export async function forceEscalate(task) {
  const now = Date.now();
  const elapsedMinutes = (now - new Date(task.created_at ?? now).getTime()) / 60_000;

  const { data: fullTask } = await supabase
    .from('tasks')
    .select(`
      id, task_code, task_type, notes, status, escalation_level, current_level, department_id,
      rooms (room_number),
      staff!assigned_staff_id (name),
      assigned_staff:staff!assigned_to (name)
    `)
    .eq('id', task.id)
    .single();

  if (!fullTask) return null;

  if (fullTask.escalation_level === 0) {
    return await escalateTask(fullTask, elapsedMinutes, 1) ?? null;
  } else if (fullTask.escalation_level === 1) {
    return await escalateTask(fullTask, elapsedMinutes, 2) ?? null;
  }

  return null;
}
