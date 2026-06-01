'use client';

import { Skeleton } from '@/components/ui/skeleton';

type TripledListLoadingStateProps = {
  label: string;
  desktopColumns?: number;
  desktopRows?: number;
  mobileCards?: number;
};

export const TripledListLoadingState = ({
  label,
  desktopColumns = 4,
  desktopRows = 6,
  mobileCards = 3,
}: TripledListLoadingStateProps) => {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <div className="hidden overflow-hidden rounded-xl border border-border/70 md:block">
        <div className="grid border-b bg-muted/20" style={{ gridTemplateColumns: `repeat(${desktopColumns}, minmax(0, 1fr))` }}>
          {Array.from({ length: desktopColumns }).map((_, index) => (
            <div key={index} className="p-3">
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        {Array.from({ length: desktopRows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid border-b last:border-0"
            style={{ gridTemplateColumns: `repeat(${desktopColumns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: desktopColumns }).map((__, columnIndex) => (
              <div key={columnIndex} className="p-3">
                <Skeleton className="h-5 w-full max-w-[9rem]" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-3 md:hidden">
        {Array.from({ length: mobileCards }).map((_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-9 w-20 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
