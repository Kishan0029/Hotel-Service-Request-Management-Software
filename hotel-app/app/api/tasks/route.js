import { supabase } from '@/lib/supabaseClient';
import { sendSMS } from '@/lib/sms';
import { checkAndEscalate } from '@/lib/escalation';

export const dynamic = 'force-dynamic';

// Full task select — includes V4 hierarchical assignment columns
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
  rooms (id, room_number, floor),
  departments (id, name, sla_minutes),
  staff!assigned_staff_id (id, name, phone_number, role),
  assigned_staff:staff!assigned_to (id, name, phone_number, role)
`;

// ── GET /api/tasks ───────────────────────────────────────────────────────────
// Filters: role, user_id, department_id, status, type, room_number
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const role         = searchParams.get('role');
  const userId       = searchParams.get('user_id');
  const departmentId = searchParams.get('department_id') || searchParams.get('department');
  const statusFilter = searchParams.get('status');
  const typeFilter   = searchParams.get('type');
  const roomFilter   = searchParams.get('room');

  // Fire-and-forget escalation check on every dashboard load
  checkAndEscalate().catch(err =>
    console.error('[Tasks GET] Escalation check failed:', err.message)
  );

  let query = supabase.from('tasks').select(TASK_SELECT);

  // ── Role-based visibility (V4) ───────────────────────────────────────────
  if (role === 'staff' && userId) {
    // Staff sees only tasks assigned directly to them
    query = query.eq('assigned_to', userId);
  } else if (role === 'supervisor' && userId) {
    // Supervisor sees only tasks assigned to them
    query = query.eq('assigned_to', userId);
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
  const body = await request.json();
  const {
    room_id,
    department_id,
    task_type,
    priority      = 'normal',
    notes,
    type          = 'request',
    created_by    = 'Reception',
    creator_role  = 'staff',       // role of user creating the task
    initial_manager_id = null,     // GM must supply: which manager to assign to
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

  if (creator_role === 'gm') {
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

  } else if (creator_role === 'manager') {
    // Manager creates → auto-assign to supervisor in dept
    const { data: sup } = await supabase
      .from('staff')
      .select('id')
      .eq('department_id', department_id)
      .eq('role', 'supervisor')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(1)
      .single();
    assignedTo   = sup?.id ?? null;
    assignedRole = sup ? 'supervisor' : null;
    currentLevel = 'supervisor';
    isUnassigned = !sup;
    sendSmsNow   = false;

  } else if (creator_role === 'supervisor') {
    // Supervisor creates → auto-assign to default staff or first active staff
    let staffId = null;
    if (dept?.default_staff_id) {
      const { data: def } = await supabase
        .from('staff').select('id, is_active').eq('id', dept.default_staff_id).single();
      if (def?.is_active) staffId = def.id;
    }
    if (!staffId) {
      const { data: any } = await supabase
        .from('staff')
        .select('id')
        .eq('department_id', department_id)
        .eq('role', 'staff')
        .eq('is_active', true)
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

  } else {
    // Reception / staff creates → auto-assign to supervisor (NOT staff directly)
    const { data: sup } = await supabase
      .from('staff')
      .select('id')
      .eq('department_id', department_id)
      .eq('role', 'supervisor')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(1)
      .single();
    assignedTo   = sup?.id ?? null;
    assignedRole = sup ? 'supervisor' : null;
    currentLevel = 'supervisor';
    isUnassigned = !sup;
    sendSmsNow   = false; // SMS only fires when task reaches staff
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
  if (sendSmsNow && data.assigned_staff?.phone_number && data.assigned_staff.phone_number !== 'N/A') {
    const time = new Date(data.created_at).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
    });
    const smsResult = await sendSMS(data.assigned_staff.phone_number, {
      task_id:    data.id,
      task_code:  data.task_code,
      staff_name: data.assigned_staff.name,
      room:       data.rooms?.room_number ?? room_id,
      task_type:  data.task_type,
      notes:      data.notes,
      time,
    });
    sms_status = smsResult.success ? 'sent' : 'failed';
  }

  checkAndEscalate().catch(err =>
    console.error('[Tasks POST] Escalation check failed:', err.message)
  );

  return Response.json({ ...data, sms_status }, { status: 201 });
}
