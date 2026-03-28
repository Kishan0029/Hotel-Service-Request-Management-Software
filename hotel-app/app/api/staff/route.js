import { supabase } from '@/lib/supabaseClient';

// GET /api/staff — list all staff with department info
export async function GET() {
  const { data, error } = await supabase
    .from('staff')
    .select(`
      id,
      name,
      phone_number,
      role,
      is_active,
      created_at,
      departments!department_id (id, name)
    `)
    .order('name', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

// POST /api/staff — create a new staff member
export async function POST(request) {
  const body = await request.json();
  const { name, phone_number, department_id, role = 'staff' } = body;

  if (!name || !phone_number || !department_id) {
    return Response.json(
      { error: 'name, phone_number, and department_id are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('staff')
    .insert({ name, phone_number, department_id, role, is_active: true })
    .select(`
      id,
      name,
      phone_number,
      role,
      is_active,
      created_at,
      departments!department_id (id, name)
    `)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
