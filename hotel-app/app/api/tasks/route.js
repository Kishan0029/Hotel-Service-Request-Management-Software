import { supabase } from '@/lib/supabaseClient';
import { sendSMS } from '@/lib/sms';
import { checkAndEscalate } from '@/lib/escalation';

export const dynamic = 'force-dynamic';

// Full task select — includes new v3 columns
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

// ── GET /api/tasks ───────────────────────────────────────────────────────────
// Filters: role, user_id, department_id, status, type, room_number
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const role         = searchParams.get('role');
  const userId       = searchParams.get('user_id');
  const departmentId = searchParams.get('department_id') || searchParams.get('department');
  const statusFilter = searchParams.get('status');       // optional: pending|acknowledged|in_progress|completed
  const typeFilter   = searchParams.get('type');         // optional: request|complaint
  const roomFilter   = searchParams.get('room');         // optional: partial room number match

  // Fire-and-forget escalation check on every dashboard load
  checkAndEscalate().catch(err =>
    console.error('[Tasks GET] Escalation check failed:', err.message)
  );

  let query = supabase.from('tasks').select(TASK_SELECT);

  // ── Role-based visibility ────────────────────────────────────────────────
  if (role === 'staff' && userId) {
    query = query.eq('assigned_staff_id', userId);
  } else if ((role === 'supervisor' || role === 'manager') && departmentId) {
    query = query.eq('department_id', departmentId);
  } else if (role === 'gm' || !role) {
    if (departmentId) query = query.eq('department_id', departmentId);
  }

  // ── Additional filters ───────────────────────────────────────────────────
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }
  if (typeFilter && typeFilter !== 'all') {
    query = query.eq('type', typeFilter);
  }
  // Room number filter is done client-side after fetch
  // (Supabase doesn't support filtering on nested relation columns directly)

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Filter by room number if provided (partial match)
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
    priority   = 'normal',
    notes,
    type       = 'request',
    created_by = 'Reception', // Name of the user creating the task (from localStorage)
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

  // ── Fetch department: SLA minutes + default staff ─────────────────────────
  const { data: dept, error: deptError } = await supabase
    .from('departments')
    .select('default_staff_id, sla_minutes')
    .eq('id', department_id)
    .single();

  if (deptError) return Response.json({ error: deptError.message }, { status: 500 });

  const expectedTime = dept?.sla_minutes ?? 10;

  // ── Resolve assigned staff (active only, with supervisor fallback) ─────────
  let assignedStaffId = null;
  let isUnassigned    = false;

  if (dept?.default_staff_id) {
    // Check if default staff is still active
    const { data: defaultStaff } = await supabase
      .from('staff')
      .select('id, is_active')
      .eq('id', dept.default_staff_id)
      .single();

    if (defaultStaff?.is_active) {
      assignedStaffId = dept.default_staff_id;
    }
  }

  // Fallback: if no active default staff, pick any active supervisor in the dept
  if (!assignedStaffId) {
    const { data: supervisor } = await supabase
      .from('staff')
      .select('id')
      .eq('department_id', department_id)
      .eq('role', 'supervisor')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(1)
      .single();

    if (supervisor) {
      assignedStaffId = supervisor.id;
      isUnassigned    = true; // flag: assigned to supervisor as fallback, not ideal
    } else {
      isUnassigned = true; // no one found at all
    }
  }

  // ── Build initial activity log ─────────────────────────────────────────────
  const now = new Date().toISOString();
  const initialLog = [
    { event: 'created', by: created_by, time: now }
  ];

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
      status:            'pending',
    })
    .select('id')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Re-fetch with full select (picks up trigger-generated task_code)
  const { data, error: fetchErr } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('id', inserted.id)
    .single();

  if (fetchErr || !data)
    return Response.json({ error: fetchErr?.message ?? 'Task not found after insert' }, { status: 500 });

  // ── Send SMS ───────────────────────────────────────────────────────────────
  let sms_status = 'no_staff';
  if (data.staff?.phone_number && data.staff.phone_number !== 'N/A') {
    const time = new Date(data.created_at).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
    });
    const smsResult = await sendSMS(data.staff.phone_number, {
      task_id:    data.id,
      task_code:  data.task_code,
      staff_name: data.staff.name,
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
