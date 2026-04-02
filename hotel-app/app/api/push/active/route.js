import { supabase } from '@/lib/supabaseClient';

export async function POST(request) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.NEXT_PUBLIC_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { staffId } = await request.json().catch(() => ({}));
  if (!staffId) return Response.json({ error: 'staffId is required' }, { status: 400 });

  // Update staff last_seen to suppress push notifications while active
  const { error } = await supabase
    .from('staff')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', staffId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
