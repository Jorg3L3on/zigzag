import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';

type TicketDetailSectionCardProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  tabIndex?: number;
  'aria-labelledby'?: string;
  'data-testid'?: string;
};

/** Quiet section surface shared by ticket detail workspace blocks. */
export const TicketDetailSectionCard = ({
  children,
  className,
  id,
  tabIndex,
  'aria-labelledby': ariaLabelledBy,
  'data-testid': testId,
}: TicketDetailSectionCardProps) => {
  return (
    <section
      id={id}
      tabIndex={tabIndex}
      aria-labelledby={ariaLabelledBy}
      data-testid={testId}
      className={cn(
        DASHBOARD_CARD_CLASS,
        'rounded-xl border p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </section>
  );
};

type TicketDetailSectionHeadingProps = {
  id: string;
  title: string;
  description?: string;
  /** Optional count shown as “Title · N”. */
  count?: number;
  action?: ReactNode;
};

export const TicketDetailSectionHeading = ({
  id,
  title,
  description,
  count,
  action,
}: TicketDetailSectionHeadingProps) => {
  return (
    <div className="mb-3 flex min-w-0 items-center justify-between gap-2 sm:items-start">
      <div className="min-w-0 space-y-1">
        <h2
          id={id}
          className="text-base font-semibold tracking-tight text-foreground"
        >
          {title}
          {typeof count === 'number' ? (
            <span className="font-normal text-muted-foreground">
              {' '}
              · {count}
            </span>
          ) : null}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
};

/** The small uppercase label that heads each card of the desktop column (canvas). */
export const TICKET_RAIL_LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground';

export const TicketDetailRailLabel = ({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) => (
  <h2 id={id} className={cn(TICKET_RAIL_LABEL_CLASS, className)}>
    {children}
  </h2>
);
