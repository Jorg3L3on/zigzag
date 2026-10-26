'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, Receipt, Ticket } from 'lucide-react';
import {
  TicketDetailRailLabel,
  TicketDetailSectionCard,
} from '@/components/tickets/detail/ticket-detail-section-card';
import type { TicketAuditHistoryEntry } from '@/actions/tickets';
import {
  formatTicketActivityCardTitle,
  getTicketTimelineIcon,
  type TicketTimelineIconKey,
} from '@/lib/ticket-audit-display';

const ACTIVITY_ICONS: Record<TicketTimelineIconKey, typeof Activity> = {
  ticket: Ticket,
  payment: Receipt,
  generic: Activity,
};

type TicketDetailActivityCardProps = {
  entries: TicketAuditHistoryEntry[];
};

const openFullTimeline = () => {
  const heading = document.getElementById('ticket-timeline-heading');
  const toggle = heading?.querySelector('button');
  if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
  document.getElementById('ticket-timeline')?.scrollIntoView({ block: 'start' });
};

/**
 * Four latest events in the column, as the canvas draws them: what happened
 * with the full amount, then «24 oct · 18:28 · Actor». Ver todo opens the full
 * timeline (ZIG-I28-2).
 */
export const TicketDetailActivityCard = ({ entries }: TicketDetailActivityCardProps) => {
  const recent = entries.slice(0, 4);

  return (
    <TicketDetailSectionCard aria-labelledby="ticket-activity-card-heading" data-testid="ticket-activity-card">
      <div className="flex items-baseline justify-between gap-3">
        <TicketDetailRailLabel id="ticket-activity-card-heading">
          Actividad · {entries.length}
        </TicketDetailRailLabel>
        <button
          type="button"
          onClick={openFullTimeline}
          className="inline-flex min-h-11 items-center text-caption font-medium text-primary outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver todo
        </button>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay eventos.</p>
      ) : (
        <ul className="mt-1 space-y-3.5">
          {recent.map((entry) => {
            const Icon = ACTIVITY_ICONS[getTicketTimelineIcon(entry.eventType)] ?? Activity;
            const when = new Date(entry.createdAt);
            return (
              <li key={entry.id} className="flex items-start gap-2.5 text-sm">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium tabular-nums [overflow-wrap:anywhere]">
                    {formatTicketActivityCardTitle(entry)}
                  </span>
                  <span className="block text-caption text-muted-foreground">
                    {format(when, "d MMM · HH:mm", { locale: es })}
                    {entry.actorName ? ` · ${entry.actorName}` : null}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </TicketDetailSectionCard>
  );
};
