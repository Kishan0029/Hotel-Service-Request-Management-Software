import { supabase } from '@/lib/supabaseClient';

// PUT /api/staff/[id] — update a staff member
export async function PUT(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const { name, phone_number, department_id, role, is_active } = body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (phone_number !== undefined) updates.phone_number = phone_number;
  if (department_id !== undefined) updates.department_id = department_id;
  if (role !== undefined) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', id)
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
  if (!data) return Response.json({ error: 'Staff not found' }, { status: 404 });
  return Response.json(data);
}

// DELETE /api/staff/[id] — soft-delete by setting is_active = false
export async function DELETE(request, { params }) {
  const { id } = params;

  const { data, error } = await supabase
    .from('staff')
    .update({ is_active: false })
    .eq('id', id)
    .select('id, name, is_active')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: 'Staff not found' }, { status: 404 });
  return Response.json({ success: true, staff: data });
}
