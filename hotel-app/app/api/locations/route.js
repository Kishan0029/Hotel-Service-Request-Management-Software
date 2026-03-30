import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

// GET /api/locations — List all locations (rooms + hotel areas)
export async function GET(request) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data, error } = await supabase
    .from('locations')
    .select('id, name, type, floor')
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data ?? []);
}

// POST /api/locations — Create a new location
export async function POST(request) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, type = 'area', floor } = body;

  if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('locations')
    .insert({ name, type, floor: floor || null })
    .select('id, name, type, floor')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
