import { supabase } from '@/lib/supabaseClient';

export async function GET(request, { params }) {
  const { id } = params;
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function PUT(request, { params }) {
  const { id } = params;
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, type, floor } = body;

  const { data, error } = await supabase
    .from('locations')
    .update({ name, type, floor })
    .eq('id', id)
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function DELETE(request, { params }) {
  const { id } = params;
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
