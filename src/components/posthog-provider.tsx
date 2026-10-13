'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { PostHog } from 'posthog-js';

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let clientPromise: Promise<PostHog | null> | null = null;

/**
 * Load and initialise posthog-js once, after the page is interactive. The
 * library is ~80 kB gzipped, so it is imported lazily instead of shipping in
 * the root layout chunk of every route (ZIG-I20-5).
 */
const loadPosthog = (): Promise<PostHog | null> => {
  if (!posthogKey || typeof window === 'undefined') {
    return Promise.resolve(null);
  }
  if (!clientPromise) {
    clientPromise = import('posthog-js').then(({ default: posthog }) => {
      posthog.init(posthogKey, {
        api_host: posthogHost,
        capture_pageview: false,
        capture_pageleave: true,
        persistence: 'localStorage+cookie',
      });
      return posthog;
    });
  }
  return clientPromise;
};

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
    if (!posthogKey) {
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
