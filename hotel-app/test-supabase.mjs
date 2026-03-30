import { createClient } from '@supabase/supabase-js';

// No need for dotenv if running with bun --env-file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log(`Connecting to Supabase at: ${supabaseUrl}`);
  const start = Date.now();
  
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('id')
      .limit(1);

    const end = Date.now();
    
    if (error) {
      console.error('Supabase Error:', error.message);
    } else {
      console.log('Successfully connected to Supabase!');
      console.log(`Response time: ${end - start}ms`);
      console.log('Data returned:', data.length > 0 ? "Yes" : "No (but empty dataset returned successfully)");
    }
  } catch (err) {
    console.error('Fetch Exception:', err.message);
  }
}

test();
