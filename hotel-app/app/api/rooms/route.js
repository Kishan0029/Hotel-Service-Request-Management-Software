import { supabase } from '@/lib/supabaseClient';

// GET /api/rooms — list all rooms
export async function GET() {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, room_number, floor, created_at')
    .order('room_number', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

// POST /api/rooms — create a room
export async function POST(request) {
  const body = await request.json();
  const { room_number, floor } = body;

  if (!room_number) {
    return Response.json({ error: 'room_number is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('rooms')
    .insert({ room_number, floor: floor || null })
    .select('id, room_number, floor, created_at')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
