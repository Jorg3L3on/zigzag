'use client';

import type { ReactNode } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { cn } from '@/lib/utils';

type MobilePullToRefreshProps = {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
  disabled?: boolean;
  label: string;
  readyLabel?: string;
  refreshingLabel?: string;
  className?: string;
  testId?: string;
};

export const MobilePullToRefresh = ({
  children,
  onRefresh,
  disabled,
  label,
  readyLabel = 'Suelta para actualizar',
  refreshingLabel = 'Actualizando',
  className,
  testId,
}: MobilePullToRefreshProps) => {
  const { containerProps, isRefreshing, pullDistance, state } =
    usePullToRefresh({
      onRefresh,
      disabled,
    });
  const showIndicator = state !== 'idle';
  const indicatorLabel =
    state === 'ready' ? readyLabel : isRefreshing ? refreshingLabel : label;

  return (
    <div
      {...containerProps}
      data-testid={testId}
      className={cn('relative', className)}
    >
      <div
        aria-live="polite"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center transition-opacity md:hidden',
          showIndicator ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          transform: `translateY(${Math.max(pullDistance - 46, 0)}px)`,
        }}
      >
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
          {isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          <span>{indicatorLabel}</span>
        </div>
      </div>

      <div
        className="transition-transform duration-150 ease-out motion-reduce:transition-none md:contents"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};
