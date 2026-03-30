import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

// ── GET /api/login ──────────────────────────────────────────────────────────
// Returns all active staff for the login dropdown, grouped by role.
// GM entries are always first.
export async function GET() {
  console.log('[Login GET] Starting request');
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('id, name, role, department_id, departments!department_id(id, name)')
      .eq('is_active', true)
      .order('name', { ascending: true });

    console.log('[Login GET] Supabase returned', { hasData: !!data, error });

    if (error) {
      console.error('[Login GET] Supabase error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Sort: gm first, then manager, supervisor, staff
    const roleOrder = { gm: 0, manager: 1, supervisor: 2, staff: 3 };
    const sorted = [...(data ?? [])].sort(
      (a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9) || (a.name || '').localeCompare(b.name || '')
    );

    console.log('[Login GET] Sorted data returning, length:', sorted.length);
    return Response.json(sorted);
  } catch (err) {
    console.error('[Login GET] Exception:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// ── POST /api/login ─────────────────────────────────────────────────────────
// Validates staff_id and returns user session data to store in localStorage.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { staff_id } = body;

  if (!staff_id) {
    return Response.json({ error: 'staff_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('staff')
    .select('id, name, role, department_id, departments!department_id(id, name)')
    .eq('id', staff_id)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return Response.json({ error: 'Staff member not found or inactive' }, { status: 404 });
  }

  return Response.json({
    id:            data.id,
    name:          data.name,
    role:          data.role,
    department_id: data.department_id,
    department_name: data.departments?.name ?? null,
  });
}
