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

  try {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return Response.json({ error: 'Invalid form data. Image might be too large (>4.5MB).' }, { status: 400 });
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

    // Fetch current task (Fix: added escalation_level)
    const { data: current, error: currentErr } = await supabase
      .from('tasks')
      .select('id, task_code, status, activity_log, department_id, assigned_to, escalation_level')
      .eq('id', id)
      .single();

    if (currentErr || !current) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    // Upload to Supabase Storage
    const ext      = file.name?.split('.').pop() || 'jpg';
    const fileName = `${id}/${photoType}_${Date.now()}.${ext}`;
    const bytes    = await file.arrayBuffer();
    const buffer   = Buffer.from(bytes);

    const { error: uploadError } = await supabase.storage
      .from('task-photos')
      .upload(fileName, buffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      return Response.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Fix: Ensure safe access to public URL
    const { data: urlData } = supabase.storage
      .from('task-photos')
      .getPublicUrl(fileName);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) throw new Error('Failed to generate public URL');

    // Build task update
    const updateData = {};
    if (photoType === 'before') {
      updateData.before_photo_url = publicUrl;
    } else {
      updateData.after_photo_url  = publicUrl;
      updateData.status           = 'completed';
      updateData.completed_at     = new Date().toISOString();
      updateData.completed_after_escalation = (current.escalation_level > 0);
    }

    // Append activity log
    let log = [];
    try {
      if (typeof current.activity_log === 'string') {
        log = JSON.parse(current.activity_log) || [];
      } else if (Array.isArray(current.activity_log)) {
        log = current.activity_log;
      }
    } catch (e) {}
    
    const eventName = photoType === 'before' ? 'before_photo_uploaded' : 'completed_with_photo';
    const updatedLog = [...log, { event: eventName, by: byName, time: new Date().toISOString() }];
    
    updateData.activity_log = JSON.stringify(updatedLog);

    // Single atomic update
    const { error: updateError } = await supabase.from('tasks').update(updateData).eq('id', id);
    if (updateError) {
      return Response.json({ error: `Database update failed: ${updateError.message}` }, { status: 500 });
    }

    // Re-fetch full task
    const { data: task, error: fetchErr } = await supabase.from('tasks').select(TASK_SELECT).eq('id', id).single();
    if (fetchErr) {
       return Response.json({ error: fetchErr.message }, { status: 500 });
    }

    // FIX 5: Notify supervisor when a MOD task is completed via after-photo.
    // Previously sendSMS was imported but never called here — supervisor had no visibility
    // of photo-completed tasks via SMS, only via UI.
    if (photoType === 'after' && task) {
      try {
        const { data: sup } = await supabase
          .from('staff')
          .select('name, phone_number')
          .eq('department_id', current.department_id)
          .eq('role', 'supervisor')
          .eq('is_active', true)
          .limit(1)
          .single();

        if (sup && sup.phone_number && sup.phone_number !== 'N/A') {
          const completedTime = new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
          });
          await sendSMS(sup.phone_number, {
            task_id:    current.id,
            task_code:  current.task_code,
            staff_name: sup.name,
            room:       task.rooms?.room_number ?? '?',
            task_type:  task.task_type ?? 'Task',
            notes:      'Completed via photo upload',
            time:       completedTime,
          });
          console.log(`[Photo Complete] Supervisor SMS sent to ${sup.phone_number} for task ${current.task_code}`);
        } else {
          console.warn(`[Photo Complete] No active supervisor with valid phone for dept ${current.department_id} (task ${current.task_code})`);
          await supabase.from('sms_logs').insert({
            task_id:    current.id,
            task_code:  current.task_code,
            event_type: 'error',
            status:     'skipped',
            message:    `Supervisor photo-completion SMS skipped: no valid supervisor phone for dept ${current.department_id}`,
          }).catch(() => {});
        }
      } catch (supSmsErr) {
        // Never let supervisor notification failure break the photo upload response
        console.error('[Photo Complete] Supervisor SMS failed:', supSmsErr.message);
      }
    }

    return Response.json({ url: publicUrl, task });

  } catch (err) {
    console.error('[PHOTO_API_CRASH]', err);
    return Response.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
