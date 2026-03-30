import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLocks() {
  console.log('Checking for active locks or long-running queries...');
  try {
    // This query lists active PIDs and what they are doing.
    // Note: On some Supabase tiers, you might not have full access to pg_stat_activity for all users,
    // but you should see your own/postgres activity.
    const { data, error } = await supabase.rpc('get_active_locks_custom'); 
    // IF RPC IS NOT DEFINED, we try generic query via REST if possible (unlikely).
    // Let's try a direct query via a dedicated endpoint if available? 
    // Actually, let's try to just query a DIFFERENT table.
    
    console.log('Testing connectivity to another table (e.g. rooms)...');
    const start = Date.now();
    const { data: rooms, error: roomsErr } = await supabase.from('rooms').select('id').limit(1);
    const end = Date.now();
    
    if (roomsErr) {
      console.error('Rooms table also hanging/errored:', roomsErr.message);
    } else {
      console.log(`Rooms table responded in ${end - start}ms`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkLocks();
