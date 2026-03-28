import { supabase } from '@/lib/supabaseClient';

// PUT /api/departments/[id] — update a department
export async function PUT(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const { name, description, default_staff_id } = body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (default_staff_id !== undefined) updates.default_staff_id = default_staff_id;

  const { data, error } = await supabase
    .from('departments')
    .update(updates)
    .eq('id', id)
    .select(`
      id,
      name,
      description,
      created_at,
      staff!default_staff_id (id, name)
    `)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: 'Department not found' }, { status: 404 });
  return Response.json(data);
}

// DELETE /api/departments/[id] — delete a department
export async function DELETE(request, { params }) {
  const { id } = params;

  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
