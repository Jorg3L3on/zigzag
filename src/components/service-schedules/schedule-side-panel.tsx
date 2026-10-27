'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, MessageCircle, Plus } from 'lucide-react';
import {
  getClientServiceScheduleHistory,
  type ClientServiceScheduleHistory,
  type ClientServiceScheduleHistoryTicket,
} from '@/actions/client-service-schedules';
import { SidePanel } from '@/components/motion';
import {
  createTicketHref,
  ScheduleActionsMenu,
  type ScheduleActionHandlers,
} from '@/components/service-schedules/schedule-actions-menu';
import {
  ScheduleBucketPill,
  ScheduleNextDue,
  scheduleWhatsAppHref,
} from '@/components/service-schedules/service-schedules-columns';
import { FormattedCurrency } from '@/components/formatted-currency';
import { Button } from '@/components/ui/button';
import {
  formatDaysSince,
  formatScheduleEvery,
  formatScheduleShortDate,
} from '@/lib/schedule-agenda-format';
import { getTicketBalanceDue } from '@/lib/ticket-payment-status';

type ScheduleSidePanelProps = ScheduleActionHandlers & {
  scheduleId: number | null;
  onClose: () => void;
  companyId: number | null;
  companyName: string | null;
  canWrite: boolean;
  canCreateTicket: boolean;
  /** Bumped by the agenda after a change so the panel reads the schedule again. */
  refreshKey: number;
};

const paymentLabel = (row: ClientServiceScheduleHistoryTicket): string => {
  if (!row.finished) return 'En proceso';
  const balance = getTicketBalanceDue(row.total, row.paid);
  if (balance <= 0) return 'Pagado';
  return row.paid > 0 ? 'Pago parcial' : 'Pendiente';
};

const TicketHistoryList = ({
  rows,
  testId,
}: {
  rows: ClientServiceScheduleHistoryTicket[];
  testId: string;
}) => (
  <ul className="divide-y divide-border/60 rounded-xl border border-border/60" data-testid={testId}>
    {rows.map((row) => (
      <li key={row.id}>
        <Link
          href={`/tickets/${row.id}`}
          className="flex items-center gap-3 px-3 py-2.5 text-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="w-16 shrink-0 font-mono text-sm">{row.folio}</span>
          <span className="w-20 shrink-0 text-muted-foreground">
            {formatScheduleShortDate(row.date)}
          </span>
          <span className="flex-1 truncate text-right tabular-nums">
            <FormattedCurrency amount={row.total} />
          </span>
          <span className="w-24 shrink-0 text-right text-caption text-muted-foreground">
            {paymentLabel(row)}
          </span>
        </Link>
      </li>
    ))}
  </ul>
);

/**
 * Side panel of a schedule (ZIG-I30, canvas RecPanel): the client, the service
 * with its pill, próximo and último with the ticket that created it, the
 * actions, the service history from tickets and the client's other tickets.
 * `?ver=<id>` keeps it open; ×, Escape or navigating closes it.
 */
export const ScheduleSidePanel = ({
  scheduleId,
  onClose,
  companyId,
  companyName,
  canWrite,
  canCreateTicket,
  refreshKey,
  ...handlers
}: ScheduleSidePanelProps) => {
  const [data, setData] = React.useState<ClientServiceScheduleHistory | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!scheduleId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getClientServiceScheduleHistory(scheduleId, companyId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setData(null);
        setError(result.error || 'No se pudo cargar el recordatorio');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scheduleId, companyId, refreshKey]);

  const schedule = data && data.schedule.id === scheduleId ? data.schedule : null;
  const whatsappHref = schedule ? scheduleWhatsAppHref(schedule, companyName) : null;

  return (
    <SidePanel
      open={scheduleId != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={schedule ? schedule.serviceName : 'Recordatorio'}
      description={schedule ? schedule.clientName : undefined}
      data-testid="schedule-side-panel"
      header={
        schedule ? (
          <div className="min-w-0 space-y-1">
            <Link
              href={`/clients/${schedule.clientId}`}
              className="block truncate text-base font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {schedule.clientName}
            </Link>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span className="tabular-nums">{schedule.clientPhone || 'Sin teléfono'}</span>
              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-emerald-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring dark:text-emerald-300"
                  aria-label={`WhatsApp a ${schedule.clientName}`}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                </a>
              ) : null}
              {schedule.clientCity ? <span>· {schedule.clientCity}</span> : null}
            </p>
          </div>
        ) : undefined
      }
    >
      {loading && !schedule ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Cargando recordatorio…
        </div>
      ) : error && !schedule ? (
        <p className="py-8 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : schedule && data ? (
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-border/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{schedule.serviceName}</h3>
                <p className="text-caption text-muted-foreground">
                  {formatScheduleEvery(schedule.intervalValue, schedule.intervalUnit)}
                </p>
              </div>
              <ScheduleBucketPill bucket={schedule.bucket} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-caption text-muted-foreground">Próximo</dt>
                <dd className="mt-0.5">
                  <ScheduleNextDue schedule={schedule} />
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Último servicio</dt>
                <dd className="mt-0.5 leading-tight">
                  {schedule.lastServiceAt ? (
                    <>
                      <div className="text-sm tabular-nums">
                        {formatScheduleShortDate(schedule.lastServiceAt)}
                      </div>
                      <div className="text-caption text-muted-foreground">
                        {formatDaysSince(schedule.daysSinceLast)}
                        {data.originTicket ? (
                          <>
                            {' · '}
                            <Link
                              href={`/tickets/${data.originTicket.id}`}
                              className="font-mono hover:underline"
                              data-testid="schedule-origin-ticket"
                            >
                              {data.originTicket.folio}
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {schedule.pausedAt ? (
            <section className="rounded-xl bg-muted/60 p-4 text-sm">
              <p className="font-medium">Pausado desde el {formatScheduleShortDate(schedule.pausedAt)}</p>
              <p className="mt-1 text-muted-foreground">
                {schedule.pauseReason?.trim() || 'Sin motivo.'}
              </p>
              {canWrite ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => handlers.onResume(schedule)}
                >
                  Reanudar
                </Button>
              ) : null}
            </section>
          ) : null}

          <div className="flex items-center gap-2">
            {canCreateTicket ? (
              <Button asChild className="min-h-11 flex-1 gap-1.5 rounded-xl">
                <Link href={createTicketHref(schedule)}>
                  <Plus className="h-4 w-4" aria-hidden data-icon="inline-start" />
                  Crear ticket
                </Link>
              </Button>
            ) : null}
            {whatsappHref ? (
              <Button asChild variant="outline" className="min-h-11 flex-1 rounded-xl">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  Recordar por WhatsApp
                </a>
              </Button>
            ) : null}
            <ScheduleActionsMenu
              schedule={schedule}
              canWrite={canWrite}
              canCreateTicket={canCreateTicket}
              whatsappHref={whatsappHref}
              showPrimary={false}
              triggerClassName="h-11 w-11 rounded-xl border"
              {...handlers}
            />
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">
              Historial de este servicio · <span className="tabular-nums">{data.serviceTicketCount}</span>
            </h3>
            {data.serviceTickets.length ? (
              <TicketHistoryList rows={data.serviceTickets} testId="schedule-service-history" />
            ) : (
              <p className="text-sm text-muted-foreground">
                Ningún ticket de este cliente tiene este servicio todavía.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Otros tickets del cliente · <span className="tabular-nums">{data.otherTicketCount}</span>
              </h3>
              <Link
                href={`/clients/${schedule.clientId}`}
                className="text-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Ver cliente
              </Link>
            </div>
            {data.otherTickets.length ? (
              <TicketHistoryList rows={data.otherTickets} testId="schedule-other-tickets" />
            ) : (
              <p className="text-sm text-muted-foreground">Sin otros tickets.</p>
            )}
          </section>
        </div>
      ) : null}
    </SidePanel>
  );
};
