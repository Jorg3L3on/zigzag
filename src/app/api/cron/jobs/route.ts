import { NextResponse } from 'next/server';
import { runDueJobs } from '@/lib/jobs/queue';
import { processAuditOutbox } from '@/lib/jobs/audit-outbox';
import { captureException } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * Cron entry point that drains the Postgres job queue and replays any captured
 * audit outbox events. Secured with CRON_SECRET: Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`. If CRON_SECRET is unset the route is
 * disabled in production to avoid an open trigger.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'CRON_SECRET not configured' },
        { status: 503 },
      );
    }
  } else {
    const authorization = request.headers.get('authorization');
    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
  }

  try {
    const jobs = await runDueJobs();
    const outbox = await processAuditOutbox();
    return NextResponse.json({ success: true, jobs, outbox });
  } catch (error) {
    captureException(error, { route: '/api/cron/jobs' });
    return NextResponse.json(
      { success: false, error: 'Job processing failed' },
      { status: 500 },
    );
  }
}
