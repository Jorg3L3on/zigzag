import { NextResponse } from 'next/server';
import { runDueJobs } from '@/lib/jobs/queue';
import { processAuditOutbox } from '@/lib/jobs/audit-outbox';
import { captureException } from '@/lib/observability';
import {
  REQUEST_ID_HEADER,
  bindRequestIdFromRequest,
} from '@/lib/request-context';

export const dynamic = 'force-dynamic';

/**
 * Cron entry point that drains the Postgres job queue and replays any captured
 * audit outbox events. Secured with CRON_SECRET: Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`. If CRON_SECRET is unset the route is
 * disabled in production to avoid an open trigger.
 */
export async function GET(request: Request) {
  const requestId = bindRequestIdFromRequest(request);
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      const response = NextResponse.json(
        { success: false, error: 'CRON_SECRET not configured' },
        { status: 503 },
      );
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }
  } else {
    const authorization = request.headers.get('authorization');
    if (authorization !== `Bearer ${secret}`) {
      const response = NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }
  }

  try {
    const jobs = await runDueJobs();
    const outbox = await processAuditOutbox();
    const response = NextResponse.json({ success: true, jobs, outbox });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch (error) {
    captureException(error, { route: '/api/cron/jobs', requestId });
    const response = NextResponse.json(
      { success: false, error: 'Job processing failed' },
      { status: 500 },
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
