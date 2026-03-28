import { supabase } from '@/lib/supabaseClient';
import { sendSMS } from '@/lib/sms';
import { forceEscalate } from '@/lib/escalation';

// ── Status transition rules ──────────────────────────────────────────────────
const VALID_TRANSITIONS = {
  pending:      ['acknowledged'],
  acknowledged: ['in_progress'],
  in_progress:  ['completed'],
  completed:    [],
};

// Human-readable event names for activity log
const EVENT_NAMES = {
  acknowledged: 'acknowledged',
  in_progress:  'started',
  completed:    'completed',
};

const TASK_SELECT = `
  id,
  task_code,
  task_type,
  type,
  priority,
  notes,
  status,
  expected_time,
  unassigned,
  activity_log,
  created_at,
  completed_at,
  escalation_level,
  escalated_at,
  completed_after_escalation,
  assigned_staff_id,
  rooms (id, room_number, floor),
  departments (id, name, sla_minutes),
  staff!assigned_staff_id (id, name, phone_number, role)
`;

// ── Helper: append to activity_log ─────────────────────────────────────────
async function appendLog(taskId, currentLog, entry) {
  const log = Array.isArray(currentLog) ? currentLog : [];
  const updated = [...log, { ...entry, time: new Date().toISOString() }];
  await supabase
    .from('tasks')
    .update({ activity_log: JSON.stringify(updated) })
    .eq('id', taskId);
  return updated;
}

// ── PATCH /api/tasks/[id] ────────────────────────────────────────────────────
// Body: { status?, staff_id?, force_escalate?, by? }
// `by` = name of the user making the change (from localStorage on client)
export async function PATCH(request, { params }) {
  const { id } = params;
  const body = await request.json().catch(() => ({}));
  const { status: newStatus, staff_id, force_escalate, by: byName = 'System' } = body;

  // Fetch current task
  const { data: current, error: fetchError } = await supabase
    .from('tasks')
    .select('id, task_code, status, escalation_level, assigned_staff_id, department_id, activity_log')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  const updates = {};

  // ── Force escalate ─────────────────────────────────────────────────────────
  if (force_escalate) {
    if (current.status === 'completed') {
      return Response.json({ error: 'Cannot escalate a completed task' }, { status: 400 });
    }
    const result = await forceEscalate(current);
    if (!result) {
      return Response.json({ error: 'No escalation target found (no supervisor/manager)' }, { status: 400 });
    }
    await appendLog(id, current.activity_log, {
      event: 'escalated',
      by:    byName,
      level: result.level,
      to:    result.escalated_to,
    });
    const { data: refreshed } = await supabase
      .from('tasks').select(TASK_SELECT).eq('id', id).single();
    return Response.json({ ...refreshed, escalated: true });
  }

  // ── Reassign staff ─────────────────────────────────────────────────────────
  if (staff_id !== undefined) {
    const { data: staffRow, error: staffErr } = await supabase
      .from('staff')
      .select('id, name, phone_number, department_id')
      .eq('id', staff_id)
      .eq('is_active', true)
      .single();

    if (staffErr || !staffRow) {
      return Response.json({ error: 'Staff member not found or inactive' }, { status: 400 });
    }
    if (staffRow.department_id !== current.department_id) {
      return Response.json(
        { error: 'Reassignment only allowed within the same department' },
        { status: 400 }
      );
    }

    // Fetch old staff name for the log
    let prevStaffName = 'Unassigned';
    if (current.assigned_staff_id) {
      const { data: prevStaff } = await supabase
        .from('staff').select('name').eq('id', current.assigned_staff_id).single();
      if (prevStaff) prevStaffName = prevStaff.name;
    }

    updates.assigned_staff_id = staff_id;
    updates.unassigned = false; // Clear unassigned flag when manually assigned

    // Send SMS to newly assigned staff
    if (current.status !== 'completed') {
      const { data: taskForSms } = await supabase
        .from('tasks')
        .select('id, task_code, task_type, notes, created_at, rooms(room_number)')
        .eq('id', id)
        .single();

      if (taskForSms && staffRow.phone_number && staffRow.phone_number !== 'N/A') {
        const time = new Date(taskForSms.created_at).toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
        });
        sendSMS(staffRow.phone_number, {
          task_id:    taskForSms.id,
          task_code:  taskForSms.task_code,
          staff_name: staffRow.name,
          room:       taskForSms.rooms?.room_number ?? '?',
          task_type:  taskForSms.task_type,
          notes:      taskForSms.notes,
          time,
        }).catch(err => console.error('[Reassign SMS]', err.message));
      }
    }

    // Apply staff_id update first so log goes in after
    await supabase.from('tasks').update(updates).eq('id', id);
    await appendLog(id, current.activity_log, {
      event: 'reassigned',
      by:    byName,
      from:  prevStaffName,
      to:    staffRow.name,
    });

    const { data: refreshed } = await supabase.from('tasks').select(TASK_SELECT).eq('id', id).single();
    return Response.json(refreshed);
  }

  // ── Status transition ──────────────────────────────────────────────────────
  if (newStatus !== undefined) {
    const allowed = VALID_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return Response.json(
        { error: `Cannot transition from '${current.status}' to '${newStatus}'` },
        { status: 400 }
      );
    }

    updates.status = newStatus;
    if (newStatus === 'completed') {
      updates.completed_at = new Date().toISOString();
      updates.completed_after_escalation = current.escalation_level > 0;
    }

    // Apply status update, then log
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select(TASK_SELECT);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) {
      return Response.json({ error: 'Update had no effect' }, { status: 409 });
    }

    await appendLog(id, current.activity_log, {
      event: EVENT_NAMES[newStatus] ?? newStatus,
      by:    byName,
    });

    // Re-fetch to get updated activity_log
    const { data: withLog } = await supabase.from('tasks').select(TASK_SELECT).eq('id', id).single();
    return Response.json(withLog ?? data[0]);
  }

  // ── Nothing to update ──────────────────────────────────────────────────────
  return Response.json({ error: 'No valid fields to update' }, { status: 400 });
}

// ── DELETE /api/tasks/[id] ────────────────────────────────────────────────────
export async function DELETE(request, { params }) {
  const { id } = params;
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
