'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import {
  getTimeOfDayGreeting,
  NEUTRAL_TIME_GREETING,
} from '@/lib/time-greeting';

export type DashboardPageIntroProps = {
  userName?: string | null;
  /** Personalized subtitle (attention count, persona copy, etc.). */
  subtitle?: string | null;
  children?: ReactNode;
};

const getDisplayName = (userName?: string | null): string | null => {
  const trimmed = userName?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.split(/\s+/)[0] ?? trimmed;
};

const useLocalTimeGreeting = (): string => {
  const [greeting, setGreeting] = React.useState(NEUTRAL_TIME_GREETING);

  React.useEffect(() => {
    setGreeting(getTimeOfDayGreeting(new Date().getHours()));
  }, []);

  return greeting;
};

export const DashboardPageIntro = ({
  userName,
  subtitle,
  children,
}: DashboardPageIntroProps) => {
  const greeting = useLocalTimeGreeting();
  const firstName = getDisplayName(userName);
  const title = firstName ? `${greeting}, ${firstName}` : greeting;
  const resolvedSubtitle =
    subtitle?.trim() || 'Resumen de tu operación';

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
        <p className="text-sm text-muted-foreground">{resolvedSubtitle}</p>
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {children}
        </div>
      ) : null}
    </header>
  );
};
