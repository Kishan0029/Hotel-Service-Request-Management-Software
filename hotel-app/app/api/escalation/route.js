import { checkAndEscalate } from '@/lib/escalation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/escalation
 * Triggers the escalation check and returns a summary of any tasks escalated.
 * Called by the dashboard auto-refresh every 15 s (fire-and-forget from client).
 */
export async function GET() {
  const escalated = await checkAndEscalate();
  return Response.json({ escalated });
}

