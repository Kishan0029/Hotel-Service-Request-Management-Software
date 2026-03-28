import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workload
 *
 * Returns active task counts per staff member, optionally filtered by department.
 * "Active" = status NOT 'completed'.
 *
 * Query params:
 *   ?department_id=2   — filter to one department
 *   ?role=supervisor&department_id=2  — supervisor view (dept-scoped)
 *
 * Response:
 * [
 *   { staff_id, staff_name, role, department_id, department_name, active_tasks: 3 },
 *   ...
 * ]
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get('department_id');

  // ── Fetch all active (non-completed) tasks ──────────────────
  let taskQuery = supabase
    .from('tasks')
    .select('assigned_staff_id, status')
    .neq('status', 'completed')
    .not('assigned_staff_id', 'is', null);

  if (departmentId) {
    taskQuery = taskQuery.eq('department_id', departmentId);
  }

  const { data: activeTasks, error: taskErr } = await taskQuery;
  if (taskErr) return Response.json({ error: taskErr.message }, { status: 500 });

  // ── Count tasks per staff_id ────────────────────────────────
  const counts = {};
  for (const t of activeTasks ?? []) {
    counts[t.assigned_staff_id] = (counts[t.assigned_staff_id] || 0) + 1;
  }

  // ── Fetch staff details ─────────────────────────────────────
  let staffQuery = supabase
    .from('staff')
    .select('id, name, role, departments!department_id (id, name)')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (departmentId) {
    staffQuery = staffQuery.eq('department_id', departmentId);
  }

  const { data: staffList, error: staffErr } = await staffQuery;
  if (staffErr) return Response.json({ error: staffErr.message }, { status: 500 });

  const result = (staffList ?? []).map(s => ({
    staff_id:        s.id,
    staff_name:      s.name,
    role:            s.role,
    department_id:   s.departments?.id,
    department_name: s.departments?.name,
    active_tasks:    counts[s.id] || 0,
  }));

  return Response.json(result);
}
