'use client';

import type { ReactNode } from 'react';

export type DashboardPageIntroProps = {
  userName?: string | null;
  /** Personalized subtitle (attention count, persona copy, etc.). */
  subtitle?: string | null;
  children?: ReactNode;
};

const getGreeting = (hour: number): string => {
  if (hour < 12) {
    return 'Buenos días';
  }
  if (hour < 19) {
    return 'Buenas tardes';
  }
  return 'Buenas noches';
};

const getDisplayName = (userName?: string | null): string | null => {
  const trimmed = userName?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.split(/\s+/)[0] ?? trimmed;
};

export const DashboardPageIntro = ({
  userName,
  subtitle,
  children,
}: DashboardPageIntroProps) => {
  const hour = new Date().getHours();
  const greeting = getGreeting(hour);
  const firstName = getDisplayName(userName);
  const title = firstName ? `${greeting}, ${firstName}` : greeting;
  const resolvedSubtitle =
    subtitle?.trim() || 'Resumen de tu operación';

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
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
