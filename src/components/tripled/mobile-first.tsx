import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

type TripledDashboardShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidthClassName?: string;
  hasMobileStickyAction?: boolean;
};

export const TripledDashboardShell = ({
  children,
  className,
  contentClassName,
  maxWidthClassName = 'max-w-none',
  hasMobileStickyAction = false,
}: TripledDashboardShellProps) => {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-4 bg-muted/20 p-3 sm:gap-6 sm:bg-background sm:p-6',
        hasMobileStickyAction
          ? 'pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-6'
          : 'pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto w-full min-w-0 overflow-x-hidden',
          maxWidthClassName,
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
};

type TripledResourceCardProps = {
  title: string;
  description: string;
  desktopDescription?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
};

export const TripledResourceCard = ({
  title,
  description,
  desktopDescription,
  icon,
  action,
  children,
  className,
  headerClassName,
  contentClassName,
}: TripledResourceCardProps) => {
  return (
    <Card
      className={cn(
        'overflow-hidden border-border/60 bg-card shadow-none sm:rounded-2xl sm:shadow-xl sm:ring-1 sm:ring-black/5 sm:dark:ring-white/10',
        className,
      )}
    >
      <CardHeader
        className={cn(
          'space-y-0 border-b border-border/50 bg-card px-4 py-4 sm:bg-gradient-to-br sm:from-muted/35 sm:via-background sm:to-background sm:px-8 sm:py-6',
          headerClassName,
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-3">
              {icon ? (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:hidden">
                  {icon}
                </span>
              ) : null}
              <div className="min-w-0">
                <CardTitle className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
                  {title}
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  {description}
                </CardDescription>
              </div>
            </div>
            {desktopDescription ? (
              <CardDescription className="hidden text-base sm:block">
                {desktopDescription}
              </CardDescription>
            ) : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className={cn('p-3 pt-4 sm:p-6 sm:pt-6', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
};

type TripledMobileAppBarProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  className?: string;
  endSlot?: ReactNode;
};

/** Reserved height for fixed mobile app bar (py-3 + h-11 row). */
export const MOBILE_APP_BAR_HEIGHT = '4.25rem';

export const TripledMobileAppBar = ({
  title,
  subtitle,
  backHref,
  backLabel = 'Volver',
  className,
  endSlot,
}: TripledMobileAppBarProps) => {
  return (
    <div
      className={cn(
        // Cancel shell top padding so the bar aligns with the viewport edge.
        '-mt-3 sm:-mt-6 md:hidden',
        className,
      )}
    >
      <header
        className="fixed inset-x-0 top-[var(--network-status-banner-offset,0px)] z-40 border-b border-border/40 bg-background/95 px-3 pb-3 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6"
        data-testid="mobile-app-bar"
      >
        <div className="flex items-center justify-between gap-3">
          {backHref ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full bg-background shadow-sm"
              asChild
              aria-label={backLabel}
            >
              <Link href={backHref} aria-label={backLabel}>
                <ArrowLeft className="h-4 w-4" aria-hidden data-icon="inline-start"/>
              </Link>
            </Button>
          ) : (
            <div className="h-11 w-11" aria-hidden />
          )}
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold">{title}</p>
            {subtitle ? (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {endSlot ?? <div className="h-11 w-11" aria-hidden />}
        </div>
      </header>
      <div aria-hidden="true" style={{ height: MOBILE_APP_BAR_HEIGHT }} />
    </div>
  );
};

type TripledMobileStickyActionBarProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

export const TripledMobileStickyActionBar = ({
  children,
  className,
  innerClassName,
}: TripledMobileStickyActionBarProps) => {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-12px_32px_-24px_rgba(15,23,42,0.45)] backdrop-blur md:hidden',
        className,
      )}
    >
      <div className={cn('mx-auto flex max-w-2xl items-center gap-3', innerClassName)}>
        {children}
      </div>
    </div>
  );
};

type TripledFilterChip = {
  key: string;
  label: ReactNode;
  variant?: 'secondary' | 'outline';
};

type TripledFilterChipsProps = {
  chips: TripledFilterChip[];
  className?: string;
};

export const TripledFilterChips = ({
  chips,
  className,
}: TripledFilterChipsProps) => {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant={chip.variant ?? 'outline'}
          className="max-w-full whitespace-normal rounded-full px-2.5 py-1 text-left leading-snug"
        >
          {chip.label}
        </Badge>
      ))}
    </div>
  );
};

type TripledMobileRecordCardProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
} & React.HTMLAttributes<HTMLElement>;

export const TripledMobileRecordCard = ({
  children,
  className,
  interactive = false,
  ...props
}: TripledMobileRecordCardProps) => {
  return (
    <article
      className={cn(
        'min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-sm',
        interactive &&
          'cursor-pointer transition-colors hover:bg-muted/40 active:bg-muted/60',
        className,
      )}
      {...props}
    >
      {children}
    </article>
  );
};
