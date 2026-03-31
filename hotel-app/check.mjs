import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fdkzorihlpdthyjunydg.supabase.co';
const supabaseKey = 'sb_publishable_lSnLb_itSETlhrUkndAQug_xCfRhAEC';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTasks() {
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  console.log("Buckets:", buckets?.map(b => b.name), "Error:", bErr?.message);

  const { data, error } = await supabase.from('tasks').select('id, before_photo_url, after_photo_url').order('created_at', { ascending: false }).limit(5);
  console.log("Tasks:", JSON.stringify(data, null, 2));

  // test upload
  const { error: upErr} = await supabase.storage.from('task-photos').upload('test.txt', 'hello');
  console.log("Upload test error:", upErr?.message || "Success");
}

checkTasks();
