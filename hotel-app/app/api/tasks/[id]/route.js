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

const EVENT_NAMES = {
  acknowledged: 'acknowledged',
  in_progress:  'started',
  completed:    'completed',
};

// Role → which role they can assign to (one level down the chain)
const ASSIGN_TO_ROLE = {
  gm:         'manager',
  manager:    'supervisor',
  supervisor: 'staff',
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
  assigned_to,
  assigned_role,
  current_level,
  before_photo_url,
  after_photo_url,
  is_mod_task,
  location_id,
  rooms (id, room_number, floor),
  departments (id, name, sla_minutes),
  staff!assigned_staff_id (id, name, phone_number, role),
  assigned_staff:staff!assigned_to (id, name, phone_number, role)
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
// Body options:
//   { status: 'acknowledged' | 'in_progress' | 'completed', by }  → status transition
//   { assign_to: staffId, assigner_role: 'manager'|'supervisor', by }  → chain assignment (V4)
//   { staff_id: staffId, by }  → legacy reassign (kept for backward compat)
//   { force_escalate: true, by }  → manual escalation
export async function PATCH(request, { params }) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = params;
  const body = await request.json().catch(() => ({}));
  const {
    status: newStatus,
    staff_id,
    assign_to,       // V4: chain-aware assignment
    assigner_role,   // V4: role of the person assigning
    force_escalate,
    by: byName = 'System',
  } = body;

  // Fetch current task
  const { data: current, error: fetchError } = await supabase
    .from('tasks')
    .select('id, task_code, status, escalation_level, assigned_staff_id, assigned_to, assigned_role, current_level, department_id, activity_log, created_at')
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

  // ── V4: Chain-aware assignment (GM→Manager, Manager→Supervisor, Supervisor→Staff) ──
  if (assign_to !== undefined && assigner_role) {
    const targetRole = ASSIGN_TO_ROLE[assigner_role];
    if (!targetRole) {
      return Response.json({ error: `Role '${assigner_role}' cannot assign tasks` }, { status: 403 });
    }

    // Fetch the target staff member and validate they are active AND on duty
    const { data: targetStaff, error: staffErr } = await supabase
      .from('staff')
      .select('id, name, phone_number, role, department_id, on_duty')
      .eq('id', assign_to)
      .eq('is_active', true)
      .single();

    if (staffErr || !targetStaff) {
      return Response.json({ error: 'Target staff member not found or inactive' }, { status: 400 });
    }

    // Fix 5: Reject assignment if staff is off-duty
    if (!targetStaff.on_duty) {
      return Response.json({ error: 'Cannot assign to off-duty staff' }, { status: 400 });
    }

    // Enforce role gate: target must be exactly one level down
    if (targetStaff.role !== targetRole) {
      return Response.json(
        { error: `${assigner_role} can only assign to ${targetRole}, not ${targetStaff.role}` },
        { status: 403 }
      );
    }

    // Manager and supervisor assignments must be within same department
    if (assigner_role !== 'gm' && targetStaff.department_id !== current.department_id) {
      return Response.json(
        { error: 'Assignment only allowed within the same department' },
        { status: 400 }
      );
    }

    // Get previous assignee name for log
    let prevName = 'Unassigned';
    if (current.assigned_to) {
      const { data: prev } = await supabase
        .from('staff').select('name').eq('id', current.assigned_to).single();
      if (prev) prevName = prev.name;
    }

    // Build update
    updates.assigned_to   = targetStaff.id;
    updates.assigned_role = targetStaff.role;
    updates.current_level = targetRole;
    updates.unassigned    = false;

    // When assigning to staff: sync legacy assigned_staff_id (needed for SMS reply)
    if (targetRole === 'staff') {
      updates.assigned_staff_id = targetStaff.id;
    }

    // Apply update
    await supabase.from('tasks').update(updates).eq('id', id);

    // Log the event
    await appendLog(id, current.activity_log, {
      event: 'assigned',
      by:    byName,
      from:  prevName,
      to:    targetStaff.name,
      level: targetRole,
    });

    // Re-fetch updated task
    const { data: refreshed } = await supabase.from('tasks').select(TASK_SELECT).eq('id', id).single();

    // Send SMS only when task reaches staff level
    if (targetRole === 'staff' && current.status !== 'completed') {
      const { data: taskForSms } = await supabase
        .from('tasks')
        .select('id, task_code, task_type, notes, created_at, rooms(room_number)')
        .eq('id', id)
        .single();

      if (taskForSms && targetStaff.phone_number && targetStaff.phone_number !== 'N/A') {
        const time = new Date(taskForSms.created_at).toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
        });
        sendSMS(targetStaff.phone_number, {
          task_id:    taskForSms.id,
          task_code:  taskForSms.task_code,
          staff_name: targetStaff.name,
          room:       taskForSms.rooms?.room_number ?? '?',
          task_type:  taskForSms.task_type,
          notes:      taskForSms.notes,
          time,
        }).catch(err => console.error('[Assign SMS]', err.message));
      }

      // Also ALWAYS send to supervisor
      if (taskForSms) {
        const time = new Date(taskForSms.created_at).toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
        });
        const { data: sup } = await supabase
          .from('staff')
          .select('name, phone_number')
          .eq('department_id', current.department_id)
          .eq('role', 'supervisor')
          .eq('is_active', true)
          .limit(1)
          .single();

        if (sup && sup.phone_number && sup.phone_number !== 'N/A') {
          sendSMS(sup.phone_number, {
            task_id:    taskForSms.id,
            task_code:  taskForSms.task_code,
            staff_name: sup.name,
            room:       taskForSms.rooms?.room_number ?? '?',
            task_type:  taskForSms.task_type,
            notes:      taskForSms.notes,
            time,
            assigned_staff_name: targetStaff.name,
          }).catch(err => console.error('[Assign SMS Sup]', err.message));
        }
      }
    }

    return Response.json(refreshed);
  }

  // ── Legacy staff_id reassign (keeping for backward compat) ─────────────────
  if (staff_id !== undefined) {
    const { data: staffRow, error: staffErr } = await supabase
      .from('staff')
      .select('id, name, phone_number, department_id, role, on_duty')
      .eq('id', staff_id)
      .eq('is_active', true)
      .single();

    if (staffErr || !staffRow) {
      return Response.json({ error: 'Staff member not found or inactive' }, { status: 400 });
    }

    // Fix 5: Reject reassignment if target staff is off-duty
    if (!staffRow.on_duty) {
      return Response.json({ error: 'Cannot assign to off-duty staff' }, { status: 400 });
    }

    if (staffRow.department_id !== current.department_id) {
      return Response.json(
        { error: 'Reassignment only allowed within the same department' },
        { status: 400 }
      );
    }

    let prevStaffName = 'Unassigned';
    if (current.assigned_to) {
      const { data: prevStaff } = await supabase
        .from('staff').select('name').eq('id', current.assigned_to).single();
      if (prevStaff) prevStaffName = prevStaff.name;
    }

    updates.assigned_staff_id = staff_id;
    updates.assigned_to       = staff_id;
    updates.assigned_role     = staffRow.role;
    updates.current_level     = staffRow.role === 'staff' ? 'staff' : current.current_level;
    updates.unassigned        = false;

    await supabase.from('tasks').update(updates).eq('id', id);
    await appendLog(id, current.activity_log, {
      event: 'reassigned',
      by:    byName,
      from:  prevStaffName,
      to:    staffRow.name,
    });

    // Send SMS only if reassigning to staff
    if (staffRow.role === 'staff' && current.status !== 'completed') {
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

      // Also ALWAYS send to supervisor
      if (taskForSms) {
        const time = new Date(taskForSms.created_at).toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
        });
        const { data: sup } = await supabase
          .from('staff')
          .select('name, phone_number')
          .eq('department_id', current.department_id)
          .eq('role', 'supervisor')
          .eq('is_active', true)
          .limit(1)
          .single();

        if (sup && sup.phone_number && sup.phone_number !== 'N/A') {
          sendSMS(sup.phone_number, {
            task_id:    taskForSms.id,
            task_code:  taskForSms.task_code,
            staff_name: sup.name,
            room:       taskForSms.rooms?.room_number ?? '?',
            task_type:  taskForSms.task_type,
            notes:      taskForSms.notes,
            time,
            assigned_staff_name: staffRow.name,
          }).catch(err => console.error('[Legacy Reassign SMS Sup]', err.message));
        }
      }
    }

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

    const { data: withLog } = await supabase.from('tasks').select(TASK_SELECT).eq('id', id).single();
    return Response.json(withLog ?? data[0]);
  }

  // ── Nothing to update ──────────────────────────────────────────────────────
  return Response.json({ error: 'No valid fields to update' }, { status: 400 });
}

// ── DELETE /api/tasks/[id] ────────────────────────────────────────────────────
export async function DELETE(request, { params }) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = params;
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
