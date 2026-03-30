import { supabase } from '@/lib/supabaseClient';

// GET /api/departments — list all departments with default staff
export async function GET(request) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data, error } = await supabase
    .from('departments')
    .select(`
      id,
      name,
      description,
      created_at,
      staff!default_staff_id (id, name)
    `)
    .order('name', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

// POST /api/departments — create a department
export async function POST(request) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const { name, description, default_staff_id } = body;

  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('departments')
    .insert({ name, description: description || null, default_staff_id: default_staff_id || null })
    .select(`
      id,
      name,
      description,
      created_at,
      staff!default_staff_id (id, name)
    `)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
