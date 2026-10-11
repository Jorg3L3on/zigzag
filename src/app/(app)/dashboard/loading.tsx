import { cookies } from 'next/headers';
import { DashboardPageIntro } from '@/components/dashboard/dashboard-page-intro';
import { DashboardRouteLoading } from '@/components/route-loading-skeletons';
import { auth } from '@/lib/auth';
import {
  getGreetingFromTimeZoneCookie,
  TIME_ZONE_COOKIE,
} from '@/lib/time-greeting';

// The greeting is the dashboard's LCP element. The page streams in after the
// first paint and React holds that reveal back ~300 ms, so the skeleton paints
// the same greeting (session + cookie only, no database) and the page swaps in
// an identical h1 that does not count as a new, larger LCP candidate.
export default async function Loading() {
  const session = await auth();
  const initialGreeting = getGreetingFromTimeZoneCookie(
    (await cookies()).get(TIME_ZONE_COOKIE)?.value,
  );

  return (
    <DashboardRouteLoading
      intro={
        session?.user ? (
          <DashboardPageIntro
            userName={session.user.name}
            initialGreeting={initialGreeting}
            subtitlePending
          />
        ) : undefined
      }
    />
  );
}
