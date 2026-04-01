import { supabase } from '@/lib/supabaseClient';
import { sendSMS } from '@/lib/sms';

export const dynamic = 'force-dynamic';

// Full task select — includes V4 hierarchical assignment + V7 photo/location columns
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

// ── GET /api/tasks ───────────────────────────────────────────────────────────
// Filters: role, user_id, department_id, status, type, room_number
export async function GET(req) {
  const key = req.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const role         = searchParams.get('role');
  const userId       = searchParams.get('user_id');
  const departmentId = searchParams.get('department_id') || searchParams.get('department');
  const statusFilter = searchParams.get('status');
  const typeFilter   = searchParams.get('type');
  const roomFilter   = searchParams.get('room');

  let query = supabase.from('tasks').select(TASK_SELECT);

  // ── Role-based visibility (V4) ───────────────────────────────────────────
  if (role === 'staff' && userId) {
    // Staff sees only tasks assigned directly to them
    query = query.eq('assigned_to', userId);
  } else if (role === 'supervisor' && departmentId) {
    // Supervisor sees all tasks in their department (to oversee/reassign staff)
    query = query.eq('department_id', departmentId);
  } else if (role === 'manager' && departmentId) {
    // Manager sees all tasks in their department
    query = query.eq('department_id', departmentId);
  } else if (role === 'gm' || role === 'reception' || !role) {
    // GM/Reception sees all tasks; optional dept override
    if (departmentId) query = query.eq('department_id', departmentId);
  }

  // ── Additional filters ───────────────────────────────────────────────────
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }
  if (typeFilter && typeFilter !== 'all') {
    query = query.eq('type', typeFilter);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let result = data ?? [];
  if (roomFilter) {
    result = result.filter(t =>
      t.rooms?.room_number?.toString().includes(roomFilter.trim())
    );
  }

  return Response.json(result);
}

// ── POST /api/tasks ──────────────────────────────────────────────────────────
export async function POST(request) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const {
    room_id,
    department_id,
    task_type,
    priority           = 'normal',
    notes,
    type               = 'request',
    created_by         = 'Reception',
    creator_role       = 'staff',  // role of user creating the task
    initial_manager_id = null,     // GM must supply: which manager to assign to
    mod_dispatch       = false,    // MOD Mode: assign directly to staff (bypass chain)
    location_id        = null,     // V7: location for MOD tasks
    before_photo_url   = null,     // V7: MOD before photo
    initial_assignee_id   = null,  // New: manager can assign directly
    initial_assignee_role = null,
  } = body;

  if (!room_id || !department_id || !task_type) {
    return Response.json(
      { error: 'room_id, department_id, and task_type are required' },
      { status: 400 }
    );
  }
  if (!['request', 'complaint'].includes(type)) {
    return Response.json({ error: 'type must be request or complaint' }, { status: 400 });
  }

  // ── Fetch department SLA ──────────────────────────────────────────────────
  const { data: dept, error: deptError } = await supabase
    .from('departments')
    .select('default_staff_id, sla_minutes')
    .eq('id', department_id)
    .single();

  if (deptError) return Response.json({ error: deptError.message }, { status: 500 });
  const expectedTime = dept?.sla_minutes ?? 10;

  // ── Determine initial assignment based on creator role ───────────────────
  let assignedTo    = null;  // assigned_to (V4 — current chain holder)
  let assignedRole  = null;  // assigned_role
  let currentLevel  = 'staff';
  let assignedStaffId = null; // legacy assigned_staff_id (only set at staff level)
  let isUnassigned  = false;
  let sendSmsNow    = false;

  const now = new Date().toISOString();

  // ── MOD Mode direct dispatch (Manager → Staff) ───────────────────────────
  if (mod_dispatch && creator_role === 'manager') {
    let staffId = null;
    if (dept?.default_staff_id) {
      const { data: def } = await supabase
        .from('staff').select('id, is_active, on_duty').eq('id', dept.default_staff_id).single();
      if (def?.is_active && def?.on_duty) staffId = def.id;
    }
    if (!staffId) {
      const { data: any } = await supabase
        .from('staff')
        .select('id')
        .eq('department_id', department_id)
        .eq('role', 'staff')
        .eq('is_active', true)
        .eq('on_duty', true)
        .order('name', { ascending: true })
        .limit(1)
        .single();
      staffId = any?.id ?? null;
    }
    assignedTo      = staffId;
    assignedRole    = staffId ? 'staff' : null;
    assignedStaffId = staffId;
    currentLevel    = 'staff';
    isUnassigned    = !staffId;
    sendSmsNow      = !!staffId;
  } else if (creator_role === 'gm') {
    // GM must provide initial_manager_id
    if (!initial_manager_id) {
      return Response.json({ error: 'GM must specify a manager to assign the task to (initial_manager_id)' }, { status: 400 });
    }
    const { data: mgr } = await supabase
      .from('staff')
      .select('id, name, role, is_active')
      .eq('id', initial_manager_id)
      .eq('role', 'manager')
      .eq('is_active', true)
      .single();
    if (!mgr) return Response.json({ error: 'Specified manager not found or inactive' }, { status: 400 });
    assignedTo   = mgr.id;
    assignedRole = 'manager';
    currentLevel = 'manager';
    sendSmsNow   = false;

  } else if (creator_role === 'manager' && !mod_dispatch) {
    if (initial_assignee_id && initial_assignee_role) {
      assignedTo      = initial_assignee_id;
      assignedRole    = initial_assignee_role;
      currentLevel    = initial_assignee_role;
      assignedStaffId = (initial_assignee_role === 'staff') ? initial_assignee_id : null;
      isUnassigned    = false;
      // V8: SMS should be sent if assigning down to supervisor or staff
      sendSmsNow      = (initial_assignee_role === 'staff' || initial_assignee_role === 'supervisor');
    } else {
      // Manager creates without MOD mode → auto-assign to supervisor in dept
      const { data: sup } = await supabase
        .from('staff')
        .select('id')
        .eq('department_id', department_id)
        .eq('role', 'supervisor')
        .eq('is_active', true)
        .eq('on_duty', true)
        .order('name', { ascending: true })
        .limit(1)
        .single();
      assignedTo      = sup?.id ?? null;
      assignedRole    = sup ? 'supervisor' : null;
      currentLevel    = 'supervisor';
      isUnassigned    = !sup;
      sendSmsNow      = !!sup; // Supervisor should get SMS
    }

  } else if (creator_role === 'supervisor' || creator_role === 'reception') {
    // Supervisor or Reception creates → auto-assign to default staff or first active+on-duty staff
    let staffId = null;
    if (dept?.default_staff_id) {
      const { data: def } = await supabase
        .from('staff').select('id, is_active, on_duty').eq('id', dept.default_staff_id).single();
      if (def?.is_active && def?.on_duty) staffId = def.id;
    }
    if (!staffId) {
      const { data: any2 } = await supabase
        .from('staff')
        .select('id')
        .eq('department_id', department_id)
        .eq('role', 'staff')
        .eq('is_active', true)
        .eq('on_duty', true)
        .order('name', { ascending: true })
        .limit(1)
        .single();
      staffId = any2?.id ?? null;
    }
    assignedTo      = staffId;
    assignedRole    = staffId ? 'staff' : null;
    assignedStaffId = staffId;
    currentLevel    = 'staff';
    isUnassigned    = !staffId;
    sendSmsNow      = !!staffId;
  }

  // ── Build initial activity log ─────────────────────────────────────────────
  const initialLog = [{ event: 'created', by: created_by, time: now }];

  // ── Insert task ────────────────────────────────────────────────────────────
  const { data: inserted, error } = await supabase
    .from('tasks')
    .insert({
      room_id,
      department_id,
      task_type,
      priority,
      notes:             notes || null,
      type,
      expected_time:     expectedTime,
      unassigned:        isUnassigned,
      activity_log:      JSON.stringify(initialLog),
      assigned_staff_id: assignedStaffId,
      assigned_to:       assignedTo,
      assigned_role:     assignedRole,
      current_level:     currentLevel,
      status:            'pending',
      is_mod_task:       mod_dispatch === true,
      location_id:       location_id || null,
      before_photo_url:  before_photo_url || null,
    })
    .select('id')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Re-fetch with full select
  const { data, error: fetchErr } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('id', inserted.id)
    .single();

  if (fetchErr || !data)
    return Response.json({ error: fetchErr?.message ?? 'Task not found after insert' }, { status: 500 });

  // ── Send SMS only if task reached staff level ─────────────────────────────
  let sms_status = 'no_staff';
  
  // 1. Send to Staff
  if (sendSmsNow && data.assigned_staff?.phone_number && data.assigned_staff.phone_number !== 'N/A') {
    const time = new Date(data.created_at).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
    });
    const smsResult = await sendSMS(data.assigned_staff.phone_number, {
      task_id:    data.id,
      task_code:  data.task_code,
      staff_name: data.assigned_staff.name,
      room:       data.rooms?.room_number ?? '?',
      task_type:  data.task_type,
      notes:      data.notes,
      time,
    });
    sms_status = smsResult.success ? 'sent' : 'failed';
  } else if (sendSmsNow) {
    await supabase.from('sms_logs').insert({
      task_id: data.id, task_code: data.task_code,
      event_type: 'error', status: 'skipped',
      message: `Staff notification skipped: No valid phone number for ${data.assigned_staff?.name || 'Unassigned'}`
    });
  }

  // 2. Also ALWAYS send to supervisor if it reached staff level
  if (sendSmsNow) {
    const time = new Date(data.created_at).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
    });
    const { data: sup } = await supabase
      .from('staff')
      .select('name, phone_number')
      .eq('department_id', department_id)
      .eq('role', 'supervisor')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (sup && sup.phone_number && sup.phone_number !== 'N/A') {
      await sendSMS(sup.phone_number, {
        task_id:    data.id,
        task_code:  data.task_code,
        staff_name: sup.name,
        room:       data.rooms?.room_number ?? '?',
        task_type:  data.task_type,
        notes:      data.notes,
        time,
        assigned_staff_name: data.assigned_staff?.name ?? 'Assigned Staff',
      }).catch(err => console.error('[POST SMS Sup]', err.message));
    } else {
      await supabase.from('sms_logs').insert({
        task_id: data.id, task_code: data.task_code,
        event_type: 'error', status: 'skipped',
        message: `Supervisor notification skipped: No active supervisor with a valid phone number for department ${department_id}`
      });
    }
  }

  // 3. Unassigned Alerting: If no staff available → alert supervisor/manager/GM
  // This fires for reception, supervisor, AND manager (MOD mode) when no on-duty staff is found
  if (isUnassigned && ['reception', 'supervisor', 'manager'].includes(creator_role)) {
    let alertTarget = null;

    // Try Supervisor
    const { data: sup } = await supabase.from('staff').select('name, phone_number').eq('department_id', department_id).eq('role', 'supervisor').eq('is_active', true).limit(1).single();
    if (sup && sup.phone_number && sup.phone_number !== 'N/A') alertTarget = { ...sup, level: 'supervisor' };

    // Try Manager
    if (!alertTarget) {
      const { data: mgr } = await supabase.from('staff').select('name, phone_number').eq('department_id', department_id).eq('role', 'manager').eq('is_active', true).limit(1).single();
      if (mgr && mgr.phone_number && mgr.phone_number !== 'N/A') alertTarget = { ...mgr, level: 'manager' };
    }

    // Try GM
    if (!alertTarget) {
      const { data: gm } = await supabase.from('staff').select('name, phone_number').eq('role', 'gm').eq('is_active', true).limit(1).single();
      if (gm && gm.phone_number && gm.phone_number !== 'N/A') alertTarget = { ...gm, level: 'gm' };
    }

    if (alertTarget) {
      const msg = `🚨 UNASSIGNED TASK\n\nRoom: ${data.rooms?.room_number ?? '?'}\nTask: ${data.task_type}\n\nNo staff available.\nImmediate action required.`;
      
      try {
        await sendSMS(alertTarget.phone_number, {
          task_id:    data.id,
          task_code:  data.task_code,
          staff_name: alertTarget.name,
          room:       data.rooms?.room_number ?? '?',
          task_type:  data.task_type,
          notes:      '🚨 ALERT: No staff available for this task.',
          time:       'Immediate',
          unassigned_alert: true,
          custom_msg: msg
        });
      } catch (e) {
        console.error('[Unassigned Alert Failed]', e.message);
      }
    } else {
      await supabase.from('sms_logs').insert({
        task_id: data.id, task_code: data.task_code,
        event_type: 'error', status: 'skipped',
        message: `Unassigned alert skipped: No active supervisor, manager, or gm with a valid phone number.`
      });
    }
  }

  return Response.json({ ...data, sms_status }, { status: 201 });
}
