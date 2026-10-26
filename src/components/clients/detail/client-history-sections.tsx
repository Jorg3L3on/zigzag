'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import type {
  ClientDetailPayment,
  ClientDetailPresupuesto,
  ClientDetailTicket,
} from '@/actions/client-detail';
import type { ClientServiceScheduleListItem } from '@/actions/client-service-schedules';
import { FormattedDate } from '@/components/formatted-date';
import { MoneyFigure } from '@/components/documents/money-figure';
import { Badge } from '@/components/ui/badge';
import {
  TICKET_PAYMENT_STATUS_LABEL,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';

const toDate = (value: string | null): Date | null => (value ? new Date(value) : null);

const Section = ({
  id,
  title,
  count,
  empty,
  children,
}: {
  id: string;
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) => (
  <section
    aria-labelledby={`client-${id}-title`}
    data-testid={`client-section-${id}`}
    className="space-y-2"
  >
    <h2 id={`client-${id}-title`} className="text-lg font-semibold">
      {title}
      <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">
        {count}
      </span>
    </h2>
    {count === 0 ? (
      <p className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
        {empty}
      </p>
    ) : (
      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
        {children}
      </ul>
    )}
  </section>
);

const Row = ({
  href,
  title,
  meta,
  right,
}: {
  href?: string;
  title: ReactNode;
  meta: ReactNode;
  right: ReactNode;
}) => {
  const body = (
    <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium [overflow-wrap:anywhere]">{title}</p>
        <p className="text-caption text-muted-foreground [overflow-wrap:anywhere]">{meta}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">{right}</div>
    </div>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="block hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
};

const STATUS_VARIANT: Record<TicketPaymentStatus, 'default' | 'secondary' | 'outline'> = {
  paid: 'secondary',
  partial: 'outline',
  pending: 'outline',
};

const SCHEDULE_BUCKET_LABEL: Record<ClientServiceScheduleListItem['bucket'], string> = {
  atrasados: 'Atrasado',
  proximos: 'Próximo',
  programados: 'Programado',
  pausados: 'Pausado',
};

const INTERVAL_UNIT_LABEL = { day: 'día', month: 'mes' } as const;
const describeInterval = (value: number, unit: ClientServiceScheduleListItem['intervalUnit']) => {
  const base = INTERVAL_UNIT_LABEL[unit] ?? unit;
  if (value === 1) return `Cada ${base}`;
  return `Cada ${value} ${base === 'mes' ? 'meses' : 'días'}`;
};

type ClientHistorySectionsProps = {
  tickets: ClientDetailTicket[];
  presupuestos: ClientDetailPresupuesto[];
  payments: ClientDetailPayment[];
  schedules: ClientServiceScheduleListItem[];
};

/** Tickets, presupuestos, pagos y recordatorios del cliente (ZIG-I17-2). */
export const ClientHistorySections = ({
  tickets,
  presupuestos,
  payments,
  schedules,
}: ClientHistorySectionsProps) => (
  <div className="space-y-6" data-testid="client-history">
    <Section
      id="tickets"
      title="Tickets"
      count={tickets.length}
      empty="Todavía no hay tickets para este cliente."
    >
      {tickets.map((t) => (
        <Row
          key={t.id}
          href={`/tickets/${t.id}`}
          title={`Ticket ${t.folio}`}
          meta={
            <>
              <FormattedDate date={toDate(t.ticketDate ?? t.createdAt)} />
              {t.workNotes?.trim() ? ` · ${t.workNotes.trim().slice(0, 60)}` : ''}
            </>
          }
          right={
            <>
              <MoneyFigure amount={t.total} size="md" />
              <Badge variant={STATUS_VARIANT[t.paymentStatus]} className="font-medium">
                {t.finished ? TICKET_PAYMENT_STATUS_LABEL[t.paymentStatus] : 'En proceso'}
              </Badge>
            </>
          }
        />
      ))}
    </Section>

    <Section
      id="presupuestos"
      title="Presupuestos"
      count={presupuestos.length}
      empty="Todavía no hay presupuestos para este cliente."
    >
      {presupuestos.map((p) => (
        <Row
          key={p.id}
          href={`/presupuestos/${p.id}`}
          title={`Presupuesto ${p.folio}`}
          meta={<FormattedDate date={toDate(p.ticketDate)} />}
          right={
            <>
              <MoneyFigure amount={p.total} size="md" />
              <Badge variant="outline" className="font-medium">
                {p.statusLabel}
              </Badge>
            </>
          }
        />
      ))}
    </Section>

    <Section
      id="pagos"
      title="Pagos"
      count={payments.length}
      empty="Todavía no hay pagos registrados."
    >
      {payments.map((p) => (
        <Row
          key={p.id}
          href={`/tickets/${p.ticketId}`}
          title={`Pago al ticket ${p.ticketFolio}`}
          meta={<FormattedDate date={toDate(p.createdAt)} />}
          right={<MoneyFigure amount={p.amount} size="md" />}
        />
      ))}
    </Section>

    <Section
      id="recordatorios"
      title="Recordatorios"
      count={schedules.length}
      empty="Sin recordatorios de servicio para este cliente."
    >
      {schedules.map((s) => (
        <Row
          key={s.id}
          // Opens this schedule's panel in the agenda (ZIG-I30); phones show the full list.
          href={`/service-schedules?vista=todos&ver=${s.id}`}
          title={s.serviceName}
          meta={
            <>
              {describeInterval(s.intervalValue, s.intervalUnit)} · próximo{' '}
              <FormattedDate date={toDate(s.nextDueAt)} />
            </>
          }
          right={
            <Badge
              variant={s.bucket === 'atrasados' ? 'destructive' : 'outline'}
              className="font-medium"
            >
              {SCHEDULE_BUCKET_LABEL[s.bucket]}
            </Badge>
          }
        />
      ))}
    </Section>
  </div>
);
