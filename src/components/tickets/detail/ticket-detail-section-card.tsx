import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';

type TicketDetailSectionCardProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  'aria-labelledby'?: string;
};

/** Quiet section surface shared by ticket detail workspace blocks. */
export const TicketDetailSectionCard = ({
  children,
  className,
  id,
  'aria-labelledby': ariaLabelledBy,
}: TicketDetailSectionCardProps) => {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledBy}
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
  action?: ReactNode;
};

export const TicketDetailSectionHeading = ({
  id,
  title,
  description,
  action,
}: TicketDetailSectionHeadingProps) => {
  return (
    <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h2
          id={id}
          className="text-base font-semibold tracking-tight text-foreground"
        >
          {title}
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
