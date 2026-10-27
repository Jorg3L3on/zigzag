'use client';

import Link from 'next/link';
import * as React from 'react';
import { createPortal } from 'react-dom';
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
import { useRegisterMobileStickyAction } from '@/contexts/mobile-chrome-context';
import { STICKY_ACTION_BOTTOM_CLASS } from '@/lib/ui/dock-clearance';
import { cn } from '@/lib/utils';

type TripledDashboardShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidthClassName?: string;
};

export const TripledDashboardShell = ({
  children,
  className,
  contentClassName,
  maxWidthClassName = 'max-w-none',
}: TripledDashboardShellProps) => {
  return (
    <div
      className={cn(
        // The shell spacer in AppMobileChrome clears the dock and any sticky action bar.
        'flex min-w-0 flex-1 flex-col gap-4 bg-muted/20 p-3 pb-4 sm:gap-6 sm:bg-background sm:p-6',
        className,
      )}
    >
      <div
        className={cn(
          // clip, not hidden: hidden makes a scroll container and turns lg:sticky
          // asides (composer rail, document PDF) into plain blocks (ZIG-I24).
          'mx-auto w-full min-w-0 overflow-x-clip',
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
  /** The one line under the title, every width (ZIG-I27-4). */
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  /**
   * Phones: just the title, no icon, description or action (the dock already
   * creates things), so the list starts higher (ZIG-I13-7).
   */
  compactOnMobile?: boolean;
  /**
   * From lg, the desktop look of the other pages (ZIG-30); phones keep the card.
   * page: no card, the header is the page title and the content a light panel.
   * title: the same without the panel, for content that frames itself.
   * section: a light card with a plain header, for pages with several cards.
   */
  desktop?: 'page' | 'title' | 'section';
};

const DESKTOP_CARD_CLASSES = {
  page: {
    card: 'lg:contents',
    header: 'lg:border-b-0 lg:bg-none lg:bg-transparent lg:p-0 lg:pb-5',
    description: 'lg:mt-1 lg:text-sm',
    content: 'lg:rounded-xl lg:border lg:border-border/60 lg:bg-card lg:p-6',
  },
  title: {
    card: 'lg:contents',
    header: 'lg:border-b-0 lg:bg-none lg:bg-transparent lg:p-0 lg:pb-5',
    description: 'lg:mt-1 lg:text-sm',
    content: 'lg:bg-transparent lg:p-0',
  },
  section: {
    // ! because the base Card's shadow-soft and hover-lift are plain classes that win otherwise.
    card: 'lg:rounded-xl lg:shadow-none! lg:ring-0 lg:hover:transform-none! lg:hover:shadow-none!',
    header: 'lg:border-b-0 lg:bg-none lg:px-6 lg:pb-0 lg:pt-5',
    title: 'lg:text-lg',
    description: 'lg:text-sm',
    content: 'lg:px-6 lg:pb-6 lg:pt-4',
  },
} satisfies Record<
  NonNullable<TripledResourceCardProps['desktop']>,
  Partial<Record<'card' | 'header' | 'title' | 'description' | 'content', string>>
>;

export const TripledResourceCard = ({
  title,
  description,
  icon,
  action,
  children,
  className,
  headerClassName,
  contentClassName,
  compactOnMobile = false,
  desktop,
}: TripledResourceCardProps) => {
  const desktopClasses: Partial<
    Record<'card' | 'header' | 'title' | 'description' | 'content', string>
  > = desktop ? DESKTOP_CARD_CLASSES[desktop] : {};

  return (
    <Card
      className={cn(
        'overflow-hidden border-border/60 bg-card shadow-none sm:rounded-2xl sm:shadow-xl sm:ring-1 sm:ring-black/5 sm:dark:ring-white/10',
        desktopClasses.card,
        className,
      )}
    >
      <CardHeader
        className={cn(
          'space-y-0 border-b border-border/50 bg-card px-4 py-4 sm:bg-gradient-to-br sm:from-muted/35 sm:via-background sm:to-background sm:px-8 sm:py-6',
          compactOnMobile && 'max-sm:py-3',
          desktopClasses.header,
          headerClassName,
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-3">
              {icon ? (
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:hidden',
                    compactOnMobile && 'hidden',
                  )}
                >
                  {icon}
                </span>
              ) : null}
              <div className="min-w-0">
                <CardTitle
                  className={cn(
                    'text-balance text-xl font-semibold tracking-tight sm:text-2xl',
                    desktopClasses.title,
                  )}
                >
                  {title}
                </CardTitle>
                <CardDescription
                  className={cn(
                    'text-sm sm:text-base',
                    compactOnMobile && 'max-sm:hidden',
                    desktopClasses.description,
                  )}
                >
                  {description}
                </CardDescription>
              </div>
            </div>
          </div>
          {compactOnMobile && action ? <div className="contents max-sm:hidden">{action}</div> : action}
        </div>
      </CardHeader>
      <CardContent className={cn('p-3 pt-4 sm:p-6 sm:pt-6', desktopClasses.content, contentClassName)}>
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
              <p className="text-caption text-muted-foreground">{subtitle}</p>
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
  useRegisterMobileStickyAction();
  // Start null on server and client alike: reading document.body during the
  // first client render made hydration output differ from the SSR markup.
  const [portalHost, setPortalHost] = React.useState<HTMLElement | null>(null);

  React.useLayoutEffect(() => {
    setPortalHost(document.body);
  }, []);

  // Portal to body so position:fixed is never trapped by animated ancestors
  // (e.g. route enter transitions that use transform/opacity wrappers).
  if (!portalHost) {
    return null;
  }

  return createPortal(
    <div
      data-testid="mobile-sticky-action-bar"
      className={cn(
        // Takes the dock's place while it is shown (the dock hides itself).
        'fixed inset-x-3 z-20 mx-auto max-w-lg rounded-2xl border bg-background/95 p-3 shadow-panel backdrop-blur md:hidden',
        STICKY_ACTION_BOTTOM_CLASS,
        className,
      )}
    >
      <div className={cn('mx-auto flex max-w-2xl items-center gap-3', innerClassName)}>
        {children}
      </div>
    </div>,
    portalHost,
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
