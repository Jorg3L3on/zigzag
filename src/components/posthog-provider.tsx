'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let initialized = false;

const initPosthog = () => {
  if (initialized || !posthogKey || typeof window === 'undefined') {
    return;
  }
  initialized = true;
  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
  });
};

const PageviewTracker = () => {
  const posthogClient = usePostHog();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || !posthogClient) {
      return;
    }
    const query = searchParams?.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    posthogClient.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams, posthogClient]);

  return null;
};

/**
 * Client analytics provider (PostHog, free tier). When
 * `NEXT_PUBLIC_POSTHOG_KEY` is unset this renders children unchanged so the app
 * works without analytics.
 */
export const PostHogProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  if (!posthogKey) {
    return <>{children}</>;
  }

  initPosthog();

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
};
