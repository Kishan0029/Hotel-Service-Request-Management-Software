import { supabase } from './lib/supabaseClient.js';

async function checkSmsLogs() {
  const { data, error } = await supabase
    .from('sms_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching sms_logs:', error);
    return;
  }

  console.log('Recent SMS Logs:');
  console.table(data.map(log => ({
    id: log.id,
    task_id: log.task_id,
    task_code: log.task_code,
    event_type: log.event_type,
    status: log.status,
    phone: log.phone,
    message: log.message?.substring(0, 30) + '...',
    created_at: log.created_at
  })));
}

checkSmsLogs();
