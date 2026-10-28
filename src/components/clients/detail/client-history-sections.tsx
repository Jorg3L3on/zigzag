'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type {
  ClientDetailPayment,
  ClientDetailPresupuesto,
  ClientDetailTicket,
} from '@/actions/client-detail';
import type { ClientServiceScheduleListItem } from '@/actions/client-service-schedules';
import { DesktopSwitch } from '@/components/desktop-switch';
import { FormattedDate } from '@/components/formatted-date';
import { MoneyFigure } from '@/components/documents/money-figure';
import { PresupuestoStatusPill } from '@/components/presupuestos/presupuesto-status-pill';
import { TicketDetailStatusPill } from '@/components/tickets/detail/ticket-detail-status-pill';
import { Badge } from '@/components/ui/badge';
import {
  LIST_TABLE_CARD_CLASS,
  LIST_TABLE_CLASS,
  LIST_TABLE_DENSE_PADDING_CLASS,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TICKET_PAYMENT_STATUS_LABEL,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

const toDate = (value: string | null): Date | null => (value ? new Date(value) : null);

const Section = ({
  id,
  title,
  count,
  empty,
  phone,
  desktop,
}: {
  id: string;
  title: string;
  count: number;
  empty: string;
  phone: ReactNode;
  desktop: ReactNode;
}) => (
  <section
    aria-labelledby={`client-${id}-title`}
    data-testid={`client-section-${id}`}
    className="space-y-2 lg:space-y-3"
  >
    <h2 id={`client-${id}-title`} className="text-lg font-semibold lg:text-base lg:tracking-tight">
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
      <DesktopSwitch
        phone={
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
            {phone}
          </ul>
        }
        desktop={desktop}
      />
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

type HistoryColumn = { label: string; className?: string };
type HistoryRow = { key: string; href: string; cells: ReactNode[] };

/**
 * Desktop history: the Cobranza table look (11 px labels on a light band, 56 px
 * rows). The first cell is the link; the rest of the row opens it too.
 */
const HistoryTable = ({
  label,
  columns,
  rows,
}: {
  label: string;
  columns: HistoryColumn[];
  rows: HistoryRow[];
}) => {
  const router = useRouter();
  const open = (href: string) => (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('a')) return;
    router.push(href);
  };
  return (
    <div className={LIST_TABLE_CARD_CLASS}>
      <table className={`${LIST_TABLE_CLASS} ${LIST_TABLE_DENSE_PADDING_CLASS}`} aria-label={label}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.label} scope="col" className={column.className}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} className="h-14 cursor-pointer" onClick={open(row.href)}>
              {row.cells.map((cell, index) => (
                <TableCell key={columns[index]?.label ?? index} className={columns[index]?.className}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );
};

/** «10 oct», with the year only when it is not this one (canvas ListaA). */
const ShortDate = ({ value }: { value: string | null }) => {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const date = new Date(value);
  const pattern = date.getFullYear() === new Date().getFullYear() ? 'd MMM' : 'd MMM yyyy';
  return (
    <span
      className="whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300"
      title={format(date, 'PPP', { locale: es })}
    >
      {format(date, pattern, { locale: es })}
    </span>
  );
};

const RowLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link
    href={href}
    className="whitespace-nowrap font-mono font-medium tabular-nums text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
  >
    {children}
  </Link>
);

const Money = ({ amount }: { amount: number }) => (
  <MoneyFigure amount={amount} size="sm" className="whitespace-nowrap [overflow-wrap:normal]" />
);

const PILL_CLASS = 'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-caption font-semibold';

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

const SCHEDULE_BUCKET_PILL: Record<ClientServiceScheduleListItem['bucket'], string> = {
  atrasados: 'bg-red-500/15 text-red-700 dark:text-red-300',
  proximos: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  programados: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  pausados: 'bg-slate-500/10 text-muted-foreground',
};

const INTERVAL_UNIT_LABEL = { day: 'día', month: 'mes' } as const;
const describeInterval = (value: number, unit: ClientServiceScheduleListItem['intervalUnit']) => {
  const base = INTERVAL_UNIT_LABEL[unit] ?? unit;
  if (value === 1) return `Cada ${base}`;
  return `Cada ${value} ${base === 'mes' ? 'meses' : 'días'}`;
};

// Fixed widths leave the free text column the rest (≈ 180 px at 1280 with the sidebar).
const FOLIO_COL = 'w-[92px]';
const DATE_COL = 'w-[96px]';
const MONEY_COL = 'w-[128px] text-right';
const STATUS_COL = 'w-[148px]';

type ClientHistorySectionsProps = {
  tickets: ClientDetailTicket[];
  presupuestos: ClientDetailPresupuesto[];
  payments: ClientDetailPayment[];
  schedules: ClientServiceScheduleListItem[];
  className?: string;
};

/** Tickets, presupuestos, pagos y recordatorios del cliente (ZIG-I17-2); tables from lg. */
export const ClientHistorySections = ({
  tickets,
  presupuestos,
  payments,
  schedules,
  className,
}: ClientHistorySectionsProps) => (
  <div className={cn('space-y-6 lg:space-y-8', className)} data-testid="client-history">
    <Section
      id="tickets"
      title="Tickets"
      count={tickets.length}
      empty="Todavía no hay tickets para este cliente."
      phone={tickets.map((t) => (
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
      desktop={
        <HistoryTable
          label="Tickets del cliente"
          columns={[
            { label: 'Folio', className: FOLIO_COL },
            { label: 'Fecha', className: DATE_COL },
            { label: 'Trabajo' },
            { label: 'Total', className: MONEY_COL },
            { label: 'Estado', className: STATUS_COL },
          ]}
          rows={tickets.map((t) => ({
            key: t.id,
            href: `/tickets/${t.id}`,
            cells: [
              <RowLink key="folio" href={`/tickets/${t.id}`}>
                {t.folio}
              </RowLink>,
              <ShortDate key="date" value={t.ticketDate ?? t.createdAt} />,
              <span key="notes" className="block truncate text-muted-foreground" title={t.workNotes?.trim() || undefined}>
                {t.workNotes?.trim() || '—'}
              </span>,
              <span key="total" className="flex flex-col items-end">
                <Money amount={t.total} />
                {t.finished && t.balanceDue > 0 && t.balanceDue < t.total ? (
                  <span className="whitespace-nowrap text-caption tabular-nums text-amber-700 dark:text-amber-300">
                    Debe <MoneyFigure amount={t.balanceDue} size="sm" className="text-inherit" />
                  </span>
                ) : null}
              </span>,
              <TicketDetailStatusPill key="status" finished={t.finished} total={t.total} paid={t.paid} />,
            ],
          }))}
        />
      }
    />

    <Section
      id="presupuestos"
      title="Presupuestos"
      count={presupuestos.length}
      empty="Todavía no hay presupuestos para este cliente."
      phone={presupuestos.map((p) => (
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
      desktop={
        <HistoryTable
          label="Presupuestos del cliente"
          columns={[
            { label: 'Folio', className: FOLIO_COL },
            { label: 'Fecha', className: DATE_COL },
            { label: 'Vence' },
            { label: 'Total', className: MONEY_COL },
            { label: 'Estado', className: STATUS_COL },
          ]}
          rows={presupuestos.map((p) => ({
            key: p.id,
            href: `/presupuestos/${p.id}`,
            cells: [
              <RowLink key="folio" href={`/presupuestos/${p.id}`}>
                {p.folio}
              </RowLink>,
              <ShortDate key="date" value={p.ticketDate} />,
              <ShortDate key="expires" value={p.expiresAt} />,
              <Money key="total" amount={p.total} />,
              <PresupuestoStatusPill key="status" status={p.status} surface="desktop" />,
            ],
          }))}
        />
      }
    />

    <Section
      id="pagos"
      title="Pagos"
      count={payments.length}
      empty="Todavía no hay pagos registrados."
      phone={payments.map((p) => (
        <Row
          key={p.id}
          href={`/tickets/${p.ticketId}`}
          title={`Pago al ticket ${p.ticketFolio}`}
          meta={<FormattedDate date={toDate(p.createdAt)} />}
          right={<MoneyFigure amount={p.amount} size="md" />}
        />
      ))}
      desktop={
        <HistoryTable
          label="Pagos del cliente"
          columns={[
            { label: 'Ticket', className: FOLIO_COL },
            { label: 'Fecha' },
            { label: 'Monto', className: MONEY_COL },
          ]}
          rows={payments.map((p) => ({
            key: String(p.id),
            href: `/tickets/${p.ticketId}`,
            cells: [
              <RowLink key="folio" href={`/tickets/${p.ticketId}`}>
                {p.ticketFolio}
              </RowLink>,
              <span key="date" className="tabular-nums text-slate-600 dark:text-slate-300">
                {format(new Date(p.createdAt), "d 'de' MMMM 'de' yyyy · HH:mm", { locale: es })}
              </span>,
              <Money key="amount" amount={p.amount} />,
            ],
          }))}
        />
      }
    />

    <Section
      id="recordatorios"
      title="Recordatorios"
      count={schedules.length}
      empty="Sin recordatorios de servicio para este cliente."
      phone={schedules.map((s) => (
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
      desktop={
        <HistoryTable
          label="Recordatorios del cliente"
          columns={[
            { label: 'Servicio' },
            { label: 'Frecuencia', className: 'w-[132px]' },
            { label: 'Próximo', className: DATE_COL },
            { label: 'Estado', className: 'w-[120px]' },
          ]}
          rows={schedules.map((s) => {
            const href = `/service-schedules?vista=todos&ver=${s.id}`;
            return {
              key: String(s.id),
              href,
              cells: [
                <Link
                  key="service"
                  href={href}
                  className="block truncate font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {s.serviceName}
                </Link>,
                <span key="interval" className="whitespace-nowrap text-slate-600 dark:text-slate-300">
                  {describeInterval(s.intervalValue, s.intervalUnit)}
                </span>,
                <ShortDate key="next" value={s.nextDueAt} />,
                <span key="bucket" className={cn(PILL_CLASS, SCHEDULE_BUCKET_PILL[s.bucket])}>
                  {SCHEDULE_BUCKET_LABEL[s.bucket]}
                </span>,
              ],
            };
          })}
        />
      }
    />
  </div>
);
