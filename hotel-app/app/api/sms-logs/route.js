import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/sms-logs
 * Returns the 100 most recent SMS log entries, newest first.
 */
export async function GET(request) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userRole = request.headers.get('x-user-role');
  const userId   = request.headers.get('x-user-id');

  if (userRole === 'staff') {
    return Response.json({ error: 'Access denied' }, { status: 403 });
  }

  let query = supabase
    .from('sms_logs')
    .select('id, task_id, task_code, event_type, status, phone, message, created_at');

  // GM and Reception can see everything.
  // Others (manager, supervisor) see only their specific logs (matching their phone number).
  if (userRole !== 'gm' && userRole !== 'reception') {
    if (!userId) {
      return Response.json({ error: 'User ID missing in request' }, { status: 401 });
    }
    // Get staff phone number for this user
    const { data: st, error: stErr } = await supabase
      .from('staff')
      .select('phone_number')
      .eq('id', userId)
      .single();

    if (stErr || !st?.phone_number) {
      return Response.json([]); // Return empty if no phone found
    }

    // Filter by phone. Match last 10 digits to catch various country code formats (Fix 5b)
    query = query.ilike('phone', `%${st.phone_number.slice(-10)}`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
