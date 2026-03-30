import { supabase } from '@/lib/supabaseClient';
import { sendSMS } from '@/lib/sms';

export const dynamic = 'force-dynamic';

const TASK_SELECT = `
  id,
  task_code,
  task_type,
  type,
  priority,
  notes,
  status,
  expected_time,
  unassigned,
  activity_log,
  created_at,
  completed_at,
  escalation_level,
  escalated_at,
  completed_after_escalation,
  assigned_staff_id,
  assigned_to,
  assigned_role,
  current_level,
  before_photo_url,
  after_photo_url,
  is_mod_task,
  location_id,
  rooms (id, room_number, floor),
  departments (id, name, sla_minutes),
  staff!assigned_staff_id (id, name, phone_number, role),
  assigned_staff:staff!assigned_to (id, name, phone_number, role)
`;

// ── POST /api/tasks/[id]/photo — Upload Before or After photo ──
export async function POST(request, { params }) {
  const { id } = params;

  // No API key check here - client-side uploads are handled directly
  // but we do validate the task exists
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return Response.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file      = formData.get('file');
  const photoType = formData.get('photo_type'); // 'before' or 'after'
  const byName    = formData.get('by') || 'Staff';

  if (!file || !photoType) {
    return Response.json({ error: 'file and photo_type are required' }, { status: 400 });
  }
  if (!['before', 'after'].includes(photoType)) {
    return Response.json({ error: 'photo_type must be before or after' }, { status: 400 });
  }

  // Fetch current task
  const { data: current } = await supabase
    .from('tasks')
    .select('id, task_code, status, activity_log, department_id, assigned_to')
    .eq('id', id)
    .single();

  if (!current) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  // Upload to Supabase Storage
  const ext      = file.name.split('.').pop() || 'jpg';
  const fileName = `${id}/${photoType}_${Date.now()}.${ext}`;
  const bytes    = await file.arrayBuffer();
  const buffer   = Buffer.from(bytes);

  const { error: uploadError } = await supabase.storage
    .from('task-photos')
    .upload(fileName, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return Response.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from('task-photos')
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  // Build task update
  const updateData = {};
  if (photoType === 'before') {
    updateData.before_photo_url = publicUrl;
  } else {
    updateData.after_photo_url  = publicUrl;
    updateData.status           = 'completed';
    updateData.completed_at     = new Date().toISOString();
    updateData.completed_after_escalation = false;
  }

  await supabase.from('tasks').update(updateData).eq('id', id);

  // Append activity log
  const log = Array.isArray(current.activity_log) ? current.activity_log : [];
  const eventName = photoType === 'before' ? 'before_photo_uploaded' : 'completed_with_photo';
  const updatedLog = [...log, { event: eventName, by: byName, time: new Date().toISOString() }];
  await supabase.from('tasks').update({ activity_log: JSON.stringify(updatedLog) }).eq('id', id);

  // Re-fetch full task
  const { data: task } = await supabase.from('tasks').select(TASK_SELECT).eq('id', id).single();
  return Response.json({ url: publicUrl, task });
}
