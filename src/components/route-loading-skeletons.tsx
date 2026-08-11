import type { ReactNode } from 'react';

import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { Skeleton } from '@/components/ui/skeleton';

type ResourceRouteLoadingProps = {
  title: string;
  description: string;
  desktopDescription: string;
  icon: ReactNode;
  label: string;
};

const ResourceListPlaceholder = ({ label }: { label: string }) => (
  <div
    className="space-y-4"
    role="status"
    aria-busy="true"
    aria-live="polite"
    aria-label={label}
  >
    <span className="sr-only">{label}</span>
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-10 w-full rounded-xl sm:max-w-xs" />
      <div className="flex gap-2">
        <Skeleton className="h-10 min-w-0 flex-1 rounded-xl sm:w-32" />
        <Skeleton className="h-10 min-w-0 flex-1 rounded-xl sm:w-32" />
      </div>
    </div>

    <div className="hidden overflow-hidden rounded-xl border border-border/70 shadow-sm md:block">
      <div className="grid grid-cols-5 border-b bg-muted/20">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="p-3">
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-5 border-b last:border-0">
          {Array.from({ length: 5 }).map((__, columnIndex) => (
            <div key={columnIndex} className="p-3">
              <Skeleton className="h-5 w-full max-w-[9rem]" />
            </div>
          ))}
        </div>
      ))}
    </div>

    <div className="space-y-3 md:hidden">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-40 max-w-full" />
              <Skeleton className="h-4 w-28 max-w-full" />
            </div>
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  </div>
);

export const ResourceRouteLoading = ({
  title,
  description,
  desktopDescription,
  icon,
  label,
}: ResourceRouteLoadingProps) => (
  <>
    <TripledPageHeader items={[{ label: title }]} />
    <TripledDashboardShell>
      <TripledResourceCard
        title={title}
        description={description}
        desktopDescription={desktopDescription}
        icon={icon}
        action={
          <Skeleton className="h-11 w-full rounded-xl sm:h-10 sm:w-36" />
        }
      >
        <ResourceListPlaceholder label={label} />
      </TripledResourceCard>
    </TripledDashboardShell>
  </>
);

export const DashboardRouteLoading = () => (
  <>
    <TripledPageHeader items={[{ label: 'Dashboard' }]} />
    <TripledDashboardShell>
      <div
        className="flex flex-col gap-6 md:gap-8"
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label="Cargando dashboard"
      >
        <span className="sr-only">Cargando dashboard</span>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56 sm:h-9 sm:w-72" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-11 w-[170px] rounded-xl sm:h-9" />
            <Skeleton className="h-11 w-32 rounded-xl sm:h-9" />
            <Skeleton className="h-11 w-32 rounded-xl sm:h-9" />
          </div>
        </div>
        <Skeleton className="h-36 rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[280px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[280px] rounded-xl" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl lg:col-span-1" />
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        </div>
      </div>
    </TripledDashboardShell>
  </>
);
