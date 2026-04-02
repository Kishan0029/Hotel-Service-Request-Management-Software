import { supabase } from '@/lib/supabaseClient';

export async function POST(request) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.NEXT_PUBLIC_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { staffId, token } = await request.json().catch(() => ({}));

  if (!staffId || !token) {
    return Response.json({ error: 'staffId and token are required' }, { status: 400 });
  }

  // Upsert the token for the staff member
  const { error } = await supabase
    .from('staff_devices')
    .upsert(
      { staff_id: staffId, fcm_token: token, last_active: new Date().toISOString() },
      { onConflict: 'staff_id, fcm_token' }
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
