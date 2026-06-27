import { History } from 'lucide-react';
import { FormattedDate } from '@/components/formatted-date';
import { FormattedCurrency } from '@/components/formatted-currency';
import type { TicketAuditHistoryEntry } from '@/actions/tickets';
import {
  describeTicketAuditEvent,
  extractTicketAuditAmount,
} from '@/lib/ticket-audit-display';

interface TicketAuditHistoryProps {
  entries: TicketAuditHistoryEntry[];
}

/**
 * Read-only timeline of immutable ticket events (creation, edits, finalization,
 * payments). Rendered from `TicketAuditEvent` rows on the ticket detail page.
 */
export const TicketAuditHistory = ({ entries }: TicketAuditHistoryProps) => {
  return (
    <section aria-labelledby="ticket-history-heading" className="space-y-5">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-muted-foreground" aria-hidden />
        <h2
          id="ticket-history-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Historial
        </h2>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Aún no hay eventos registrados para este ticket.
        </p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => {
            const amount = extractTicketAuditAmount(
              entry.eventType,
              entry.payload,
            );
            return (
              <li
                key={entry.id}
                className="flex gap-3 rounded-xl border border-border/60 bg-background px-4 py-3 shadow-sm"
              >
                <div
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {describeTicketAuditEvent(entry.eventType)}
                    </p>
                    <time className="text-xs text-muted-foreground">
                      <FormattedDate date={entry.createdAt} />
                    </time>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Por {entry.actorName ?? 'Sistema'}
                    {amount != null ? (
                      <>
                        {' · '}
                        <span className="font-medium text-foreground">
                          <FormattedCurrency amount={amount} />
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};
