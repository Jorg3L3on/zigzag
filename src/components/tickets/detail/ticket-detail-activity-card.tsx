'use client';

import { FormattedDate } from '@/components/formatted-date';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import type { TicketAuditHistoryEntry } from '@/actions/tickets';
import { formatTicketTimelineEntry } from '@/lib/ticket-audit-display';

type TicketDetailActivityCardProps = {
  entries: TicketAuditHistoryEntry[];
};

const openFullTimeline = () => {
  const heading = document.getElementById('ticket-timeline-heading');
  const toggle = heading?.querySelector('button');
  if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
  document.getElementById('ticket-timeline')?.scrollIntoView({ block: 'start' });
};

/** Four latest events in the column. Ver todo opens the full timeline (ZIG-I28-2). */
export const TicketDetailActivityCard = ({ entries }: TicketDetailActivityCardProps) => {
  const recent = entries.slice(0, 4);

  return (
    <TicketDetailSectionCard aria-labelledby="ticket-activity-card-heading" data-testid="ticket-activity-card">
      <TicketDetailSectionHeading id="ticket-activity-card-heading" title="Actividad" count={entries.length} />
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay eventos.</p>
      ) : (
        <ul className="space-y-3">
          {recent.map((entry) => {
            const formatted = formatTicketTimelineEntry(entry);
            return (
              <li key={entry.id} className="text-sm">
                <p className="font-medium [overflow-wrap:anywhere]">{formatted.title}</p>
                <p className="text-caption text-muted-foreground">
                  <FormattedDate withTime date={entry.createdAt} />
                  {entry.actorName ? ` · ${entry.actorName}` : null}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        onClick={openFullTimeline}
        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        Ver todo
      </button>
    </TicketDetailSectionCard>
  );
};
