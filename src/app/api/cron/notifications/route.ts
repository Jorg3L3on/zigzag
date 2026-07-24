import { NextResponse } from 'next/server';
import { materializeScheduleNotificationsForAllCompanies } from '@/lib/notifications';
import { runDueJobs } from '@/lib/jobs/queue';
import { processAuditOutbox } from '@/lib/jobs/audit-outbox';
import { captureException } from '@/lib/observability';
import {
  REQUEST_ID_HEADER,
  bindRequestIdFromRequest,
} from '@/lib/request-context';

export const dynamic = 'force-dynamic';

/**
 * Daily cron entry point. Materializes service-schedule reminder notifications,
 * drains the background job queue, and replays the audit outbox. Consolidated
 * into one cron to stay within the Vercel Hobby plan's cron limits (a single
 * daily schedule). The dedicated `/api/cron/jobs` route remains available for
 * more frequent triggering on paid plans or via an external scheduler.
 *
 * Secured with CRON_SECRET: Vercel Cron sends `Authorization: Bearer
 * <CRON_SECRET>`. If CRON_SECRET is unset the route is disabled in production to
 * avoid an open trigger.
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
    const result = await materializeScheduleNotificationsForAllCompanies();
    const jobs = await runDueJobs();
    const outbox = await processAuditOutbox();
    const response = NextResponse.json({
      success: true,
      ...result,
      jobs,
      outbox,
    });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch (error) {
    captureException(error, { route: '/api/cron/notifications', requestId });
    const response = NextResponse.json(
      { success: false, error: 'Notification materialization failed' },
      { status: 500 },
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
