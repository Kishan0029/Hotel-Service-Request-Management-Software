import { supabase } from '@/lib/supabaseClient';

// GET /api/staff — list all staff with department info
export async function GET(request) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }
  const { data, error } = await supabase
    .from('staff')
    .select(`
      id,
      name,
      phone_number,
      role,
      is_active,
      on_duty,
      created_at,
      department_id,
      departments!department_id (id, name)
    `)
    .order('name', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

// POST /api/staff — create a new staff member
export async function POST(request) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }
  const body = await request.json();
  const { name, phone_number, department_id, role = 'staff', on_duty = true } = body;

  if (!name || !phone_number || !department_id) {
    return Response.json(
      { error: 'name, phone_number, and department_id are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('staff')
    .insert({ name, phone_number, department_id, role, is_active: true, on_duty })
    .select(`
      id,
      name,
      phone_number,
      role,
      is_active,
      on_duty,
      created_at,
      department_id,
      departments!department_id (id, name)
    `)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
