import { NextResponse } from 'next/server';
import { materializeScheduleNotificationsForAllCompanies } from '@/lib/notifications';
import { captureException } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * Cron entry point that materializes service-schedule reminder notifications for
 * every company. Secured with CRON_SECRET: Vercel Cron sends
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
    const result = await materializeScheduleNotificationsForAllCompanies();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    captureException(error, { route: '/api/cron/notifications' });
    return NextResponse.json(
      { success: false, error: 'Notification materialization failed' },
      { status: 500 },
    );
  }
}
