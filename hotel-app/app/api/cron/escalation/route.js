import { checkAndEscalate } from '@/lib/escalation'

export async function GET(request) {
  const key = request.headers.get('x-api-key') || (new URL(request.url)).searchParams.get('key');
  
  if (key !== process.env.INTERNAL_API_KEY && request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const result = await checkAndEscalate();
    return Response.json({ ok: true, result });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
