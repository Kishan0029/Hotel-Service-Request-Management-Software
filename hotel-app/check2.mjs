import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://fdkzorihlpdthyjunydg.supabase.co';
const supabaseKey = 'sb_publishable_lSnLb_itSETlhrUkndAQug_xCfRhAEC';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTasks() {
  let out = "";
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  out += "Buckets: " + JSON.stringify(buckets?.map(b => b.name)) + " Error: " + (bErr?.message) + "\n";

  const { data, error } = await supabase.from('tasks').select('id, before_photo_url, after_photo_url').order('created_at', { ascending: false }).limit(5);
  out += "Tasks: " + JSON.stringify(data, null, 2) + "\n";

  // test upload
  const { error: upErr} = await supabase.storage.from('task-photos').upload('test.txt', 'hello');
  out += "Upload test error: " + (upErr?.message || "Success") + "\n";

  fs.writeFileSync('out.txt', out);
}

checkTasks();
