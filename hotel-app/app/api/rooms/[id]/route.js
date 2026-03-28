import { supabase } from '@/lib/supabaseClient';

// PUT /api/rooms/[id] — update a room
export async function PUT(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const { room_number, floor } = body;

  const updates = {};
  if (room_number !== undefined) updates.room_number = room_number;
  if (floor !== undefined) updates.floor = floor;

  const { data, error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', id)
    .select('id, room_number, floor, created_at')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: 'Room not found' }, { status: 404 });
  return Response.json(data);
}

// DELETE /api/rooms/[id] — delete a room (only if no active tasks)
export async function DELETE(request, { params }) {
  const { id } = params;

  const { error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
