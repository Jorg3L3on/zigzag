import type { ReactNode } from 'react';

import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ResourceRouteLoadingProps = {
  title: string;
  description: string;
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
  icon,
  label,
}: ResourceRouteLoadingProps) => (
  <>
    <TripledPageHeader items={[{ label: title }]} />
    <TripledDashboardShell>
      <TripledResourceCard
        title={title}
        description={description}
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

export const DashboardRouteLoading = ({
  intro,
}: {
  /** The real greeting header, so the LCP text paints with the first frame. */
  intro?: ReactNode;
}) => (
  <>
    <TripledPageHeader items={[{ label: 'Hoy' }]} />
    <TripledDashboardShell>
      <div
        className="flex flex-col gap-6 md:gap-8"
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label="Cargando dashboard"
      >
        <span className="sr-only">Cargando dashboard</span>
        {intro ?? (
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
        )}
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

type DocumentListRouteLoadingProps = {
  title: string;
  description: string;
  icon: ReactNode;
  breadcrumbs: { label: string; href?: string }[];
  /** The list's own loading state, so the route and the list look the same. */
  children: ReactNode;
};

/**
 * Tickets and Presupuestos while the route loads (ZIG-28): the same shell as the
 * page, so from md there is no card around the list, only its heading, tabs, filters
 * and table; phones keep the card header.
 */
export const DocumentListRouteLoading = ({
  title,
  description,
  icon,
  breadcrumbs,
  children,
}: DocumentListRouteLoadingProps) => (
  <>
    <TripledPageHeader items={breadcrumbs} />
    <TripledDashboardShell>
      <TripledResourceCard
        compactOnMobile
        className="md:contents"
        headerClassName="md:hidden"
        contentClassName="md:bg-transparent md:p-0 md:pt-0"
        title={title}
        description={description}
        icon={icon}
      >
        <div className="mb-4 hidden items-center justify-between gap-4 md:flex">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        {children}
      </TripledResourceCard>
    </TripledDashboardShell>
  </>
);

const RailCardPlaceholder = ({ className }: { className?: string }) => (
  <div className={cn('space-y-3 rounded-2xl border border-border/70 bg-card p-4', className)}>
    <Skeleton className="h-3 w-20" />
    <Skeleton className="h-7 w-32" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-4/5" />
    <Skeleton className="h-11 w-full rounded-md" />
  </div>
);

/**
 * A ticket or presupuesto while the route loads (ZIG-28), in the receipt's shape:
 * header, then the document with its line grid and totals beside the rail (from a
 * 60rem page; narrower, the rail first, as the page does). Phones get the app bar
 * and stacked cards.
 */
export const DocumentDetailRouteLoading = ({
  breadcrumbs,
  label,
}: {
  breadcrumbs: { label: string; href?: string }[];
  label: string;
}) => (
  <>
    <TripledPageHeader items={breadcrumbs} className="hidden md:flex" />
    <TripledDashboardShell maxWidthClassName="max-w-[1200px]">
      <div
        className="@container flex flex-col gap-4 md:gap-6"
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label={label}
      >
        <span className="sr-only">{label}</span>

        <div className="flex items-center justify-between gap-3 md:hidden">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>

        <div className="hidden flex-col gap-3 md:flex lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-10 rounded-md" />
          </div>
        </div>

        <Skeleton className="h-28 w-full rounded-2xl lg:hidden" />

        <div className="grid gap-4 md:gap-6 @min-[60rem]:grid-cols-[minmax(0,1fr)_300px] @min-[60rem]:items-start @min-[60rem]:gap-x-8 @min-[66rem]:grid-cols-[minmax(0,1fr)_320px] @min-[72rem]:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 rounded-2xl border border-border/70 bg-card p-4 md:p-6 @min-[60rem]:col-start-1 @min-[60rem]:row-start-1">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="hidden h-8 w-44 rounded-full lg:block" />
            </div>
            <div className="hidden grid-cols-[minmax(0,1fr)_72px_120px_130px] gap-4 border-b border-border/60 pb-2 lg:grid">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-10 justify-self-end" />
              <Skeleton className="h-3 w-16 justify-self-end" />
              <Skeleton className="h-3 w-16 justify-self-end" />
            </div>
            <div className="divide-y divide-border/60">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-4 py-3 lg:grid lg:grid-cols-[minmax(0,1fr)_72px_120px_130px]"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-48 max-w-full" />
                    <Skeleton className="hidden h-3 w-64 max-w-full lg:block" />
                  </div>
                  <Skeleton className="hidden h-4 w-8 justify-self-end lg:block" />
                  <Skeleton className="hidden h-4 w-20 justify-self-end lg:block" />
                  <Skeleton className="h-4 w-20 justify-self-end" />
                </div>
              ))}
            </div>
            <div className="ml-auto mt-4 w-full max-w-64 space-y-2 border-t border-border/60 pt-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:order-first lg:gap-6 lg:@max-[60rem]:grid lg:@max-[60rem]:grid-cols-2 lg:@max-[60rem]:items-start lg:@max-[60rem]:gap-4 @min-[60rem]:col-start-2 @min-[60rem]:row-start-1">
            <RailCardPlaceholder />
            <RailCardPlaceholder className="hidden lg:block" />
            <RailCardPlaceholder className="hidden lg:block" />
          </div>
        </div>
      </div>
    </TripledDashboardShell>
  </>
);

/**
 * Creating or editing a ticket or presupuesto while the route loads (ZIG-28): a
 * neutral composer shape, so neither the list nor the receipt skeleton shows there.
 */
export const DocumentComposerRouteLoading = ({ label }: { label: string }) => (
  <TripledDashboardShell maxWidthClassName="max-w-[1200px]">
    <div
      className="flex flex-col gap-4 md:gap-6"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 md:p-6">
          <Skeleton className="h-11 w-full rounded-md" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
        <RailCardPlaceholder className="hidden lg:block" />
      </div>
    </div>
  </TripledDashboardShell>
);
