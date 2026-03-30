import { checkAndEscalate } from '@/lib/escalation';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const escalated = await checkAndEscalate();
    return Response.json({ success: true, timestamp: new Date().toISOString(), escalated });
  } catch (err) {
    console.error('[Escalation Cron] Error:', err.message);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
