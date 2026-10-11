'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import {
  getTimeOfDayGreeting,
  NEUTRAL_TIME_GREETING,
  rememberBrowserTimeZone,
} from '@/lib/time-greeting';

export type DashboardPageIntroProps = {
  userName?: string | null;
  /** Personalized subtitle (attention count, persona copy, etc.). */
  subtitle?: string | null;
  /**
   * Greeting rendered on the server from the browser time zone cookie. When it
   * matches the browser clock nothing re-renders, so the h1 (the LCP element)
   * keeps its first paint instead of repainting after hydration.
   */
  initialGreeting?: string | null;
  /** Route loading: subtitle placeholder until the page knows the experience mode. */
  subtitlePending?: boolean;
  children?: ReactNode;
};

const getDisplayName = (userName?: string | null): string | null => {
  const trimmed = userName?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.split(/\s+/)[0] ?? trimmed;
};

const useLocalTimeGreeting = (initialGreeting?: string | null): string => {
  const [greeting, setGreeting] = React.useState(
    initialGreeting || NEUTRAL_TIME_GREETING,
  );

  React.useEffect(() => {
    // Same value as the server greeting is a no-op render.
    setGreeting(getTimeOfDayGreeting(new Date().getHours()));
    rememberBrowserTimeZone();
  }, []);

  return greeting;
};

export const DashboardPageIntro = ({
  userName,
  subtitle,
  initialGreeting,
  subtitlePending = false,
  children,
}: DashboardPageIntroProps) => {
  const greeting = useLocalTimeGreeting(initialGreeting);
  const firstName = getDisplayName(userName);
  const title = firstName ? `${greeting}, ${firstName}` : greeting;
  const resolvedSubtitle =
    subtitle?.trim() || 'Lo de hoy';

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-1">
        <h1
          className="truncate text-3xl font-semibold tracking-tight text-foreground"
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
          suppressHydrationWarning
        >
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {subtitlePending ? (
            <span
              className="inline-block h-4 w-40 animate-pulse rounded-md bg-muted align-middle"
              aria-hidden
            />
          ) : (
            resolvedSubtitle
          )}
        </p>
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {children}
        </div>
      ) : null}
    </header>
  );
};
