import { cleanupOldPhotos } from '@/lib/cleanup';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/cleanup — Automated photo cleanup cron.
 * Purges old photos from Supabase Storage according to the configuration.
 */
export async function GET(request) {
  const key = request.headers.get('x-api-key') || (new URL(request.url)).searchParams.get('key');
  
  // Security check for cron execution
  if (key !== process.env.INTERNAL_API_KEY && request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const result = await cleanupOldPhotos();
    return Response.json({ ok: true, result });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
