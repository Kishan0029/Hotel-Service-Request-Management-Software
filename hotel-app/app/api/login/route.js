import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

// ── POST /api/login — Email + Password Authentication ────────
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { email, password } = body;

  if (!email || !password) {
    return Response.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('staff')
    .select('id, name, role, department_id, email, password, departments!department_id(id, name)')
    .eq('email', email.toLowerCase().trim())
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return Response.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  // Simple plaintext password check (as per user requirement)
  if (data.password !== password) {
    return Response.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  return Response.json({
    id:              data.id,
    name:            data.name,
    role:            data.role,
    department_id:   data.department_id,
    department_name: data.departments?.name ?? null,
  });
}

// ── GET /api/login — For admin use (fetch staff list) ─────────
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('id, name, role, email, department_id, departments!department_id(id, name)')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data ?? []);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
