'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { PostHog } from 'posthog-js';

import { isClientAnalyticsEnabled, loadPosthog } from '@/lib/client-analytics';

const whenIdle = (callback: () => void): (() => void) => {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 2_000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 1);
  return () => window.clearTimeout(id);
};

const PageviewTracker = ({ client }: { client: PostHog }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) {
      return;
    }
    const query = searchParams?.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    client.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams, client]);

  return null;
};

/**
 * Client analytics provider (PostHog, free tier). When
 * `NEXT_PUBLIC_POSTHOG_KEY` is unset this renders children unchanged so the app
 * works without analytics. `useSearchParams` in the tracker only mounts once
 * the client has loaded, so no Suspense fallback paints on first render.
 */
export const PostHogProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [client, setClient] = useState<PostHog | null>(null);

  useEffect(() => {
    if (!isClientAnalyticsEnabled()) {
      return;
    }
    let cancelled = false;
    const cancelIdle = whenIdle(() => {
      void loadPosthog().then((loaded) => {
        if (!cancelled && loaded) {
          setClient(loaded);
        }
      });
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, []);

  return (
    <>
      {client ? <PageviewTracker client={client} /> : null}
      {children}
    </>
  );
};
