'use client';

import type { ComponentType } from 'react';
import { Activity, History, Receipt, Ticket } from 'lucide-react';
import type { TicketAuditHistoryEntry } from '@/actions/tickets';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import {
  formatTicketTimelineEntry,
  type TicketTimelineIconKey,
} from '@/lib/ticket-audit-display';
import { formatRelativeActivityTime } from '@/lib/format-relative-time';

type TicketDetailTimelineProps = {
  entries: TicketAuditHistoryEntry[];
};

const ICON_MAP: Record<
  TicketTimelineIconKey,
  ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
> = {
  ticket: Ticket,
  payment: Receipt,
  generic: Activity,
};

export const TicketDetailTimeline = ({ entries }: TicketDetailTimelineProps) => {
  return (
    <TicketDetailSectionCard aria-labelledby="ticket-timeline-heading">
      <TicketDetailSectionHeading
        id="ticket-timeline-heading"
        title="Actividad"
        description="Línea de tiempo del ticket"
      />

      {entries.length === 0 ? (
        <p className="rounded-lg bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
          Aún no hay eventos registrados para este ticket.
        </p>
      ) : (
        <ol className="space-y-1">
          {entries.map((entry) => {
            const formatted = formatTicketTimelineEntry({
              eventType: entry.eventType,
              actorName: entry.actorName,
              payload: entry.payload,
            });
            const Icon = ICON_MAP[formatted.icon] ?? Activity;
            const occurredAt =
              entry.createdAt instanceof Date
                ? entry.createdAt
                : new Date(entry.createdAt);
            const relative = formatRelativeActivityTime(occurredAt);
            const absolute = occurredAt.toLocaleString('es-MX');

            return (
              <li key={entry.id}>
                <div className="flex items-start gap-3 rounded-lg px-1 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-medium leading-snug text-foreground">
                      {formatted.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.actorName?.trim() || 'Sistema'}
                    </p>
                  </div>
                  <time
                    className="shrink-0 text-xs tabular-nums text-muted-foreground"
                    dateTime={occurredAt.toISOString()}
                    title={absolute}
                  >
                    {relative}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {entries.length > 0 ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <History className="h-3.5 w-3.5" aria-hidden />
          Eventos inmutables del historial de auditoría
        </p>
      ) : null}
    </TicketDetailSectionCard>
  );
};
