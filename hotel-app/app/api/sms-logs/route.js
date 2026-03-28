import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/sms-logs
 * Returns the 100 most recent SMS log entries, newest first.
 */
export async function GET() {
  const { data, error } = await supabase
    .from('sms_logs')
    .select('id, task_id, task_code, event_type, status, phone, message, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
