import { supabase } from '@/lib/supabaseClient';

const CLEANUP_DAYS = parseInt(process.env.STORAGE_CLEANUP_DAYS ?? '30', 10);

/** 
 * Automatically purges old photo evidence from storage to save space.
 * Default: 30 days.
 */
export async function cleanupOldPhotos() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_DAYS);
    const cutoffStr = cutoffDate.toISOString();

    console.log(`[Cleanup] Starting purge of photos older than ${CLEANUP_DAYS} days (Cutoff: ${cutoffStr})`);

    // 1. Find tasks with photos older than the cutoff
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, before_photo_url, after_photo_url')
      .lt('created_at', cutoffStr)
      .or('before_photo_url.is.not.null,after_photo_url.is.not.null');

    if (error) {
      console.error('[Cleanup] Failed to fetch old tasks:', error.message);
      return { success: false, error: error.message };
    }

    if (!tasks || tasks.length === 0) {
      console.log('[Cleanup] No old photos found to purge.');
      return { success: true, deletedCount: 0 };
    }

    let deletedFilesCount = 0;
    
    // 2. Iterate and delete from Storage
    for (const task of tasks) {
      const filesToDelete = [];
      if (task.before_photo_url) filesToDelete.push(extractPath(task.before_photo_url));
      if (task.after_photo_url)  filesToDelete.push(extractPath(task.after_photo_url));

      const paths = filesToDelete.filter(Boolean);
      if (paths.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from('task-photos')
          .remove(paths);

        if (storageErr) {
          console.error(`[Cleanup] Error removing files for task ${task.id}:`, storageErr.message);
        } else {
          // 3. Atomically nullify URLs in DB so they don't break the UI
          await supabase
            .from('tasks')
            .update({ before_photo_url: null, after_photo_url: null })
            .eq('id', task.id);
          
          deletedFilesCount += paths.length;
        }
      }
    }

    console.log(`[Cleanup] Successfully deleted ${deletedFilesCount} files.`);
    return { success: true, deletedCount: deletedFilesCount };
  } catch (err) {
    console.error('[Cleanup] Fatal error:', err.message);
    return { success: false, error: err.message };
  }
}

/** Extracts the storage path from a Supabase public URL */
function extractPath(url) {
  if (!url) return null;
  try {
    const identifier = '/task-photos/';
    const index = url.indexOf(identifier);
    if (index === -1) return null;
    return decodeURIComponent(url.substring(index + identifier.length));
  } catch {
    return null;
  }
}
