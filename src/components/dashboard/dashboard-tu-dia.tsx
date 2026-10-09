'use client';

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  MoreHorizontal,
} from 'lucide-react';
import { getDashboardDayQueue } from '@/actions/dashboard-day-queue';
import { BlurFade } from '@/components/motion';
import { FieldSyncNowButton } from '@/components/field/field-sync-now-button';
import { JobWhatsAppSendMenu } from '@/components/field/job-whatsapp-send-menu';
import { SyncStatusBadge } from '@/components/field/sync-status-badge';
import { TicketListCollectPaymentDialog } from '@/components/tickets/ticket-list-collect-payment-dialog';
import { TripledEmptyState } from '@/components/tripled';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
import { useCompany } from '@/contexts/company-context';
import { useFieldJobStore } from '@/hooks/use-field-job-store';
import { useFieldJobSync } from '@/hooks/use-field-job-sync';
import { usePermissions } from '@/hooks/use-permissions';
import type { CobranzaRow } from '@/lib/cobranza';
import {
  DAY_QUEUE_FILTERS,
  daysLate,
  pickDefaultDayQueueFilter,
  type DashboardDayQueue,
  type DayQueueFilter,
  type DayQueueScheduleRow,
} from '@/lib/dashboard-day-queue';
import {
  mergeTechnicianDayWithLocalJobs,
  type MergedTechnicianDayTicket,
} from '@/lib/field-jobs';
import {
  toFieldJobSnapshotFromCobranzaRow,
  toFieldJobSnapshotFromDayTicket,
  type FieldJobSnapshot,
  type FieldSendOptionId,
} from '@/lib/field-job-snapshot';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { canReadServiceSchedules } from '@/lib/service-schedules-rbac';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { formatTicketListAmount } from '@/lib/ticket-payment-status';
import { canWriteTickets } from '@/lib/tickets-rbac';
import { buildWhatsAppBalanceShare } from '@/lib/whatsapp-share';
import { cn } from '@/lib/utils';

const TILE_LABELS: Record<DayQueueFilter, { long: string; short: string }> = {
  hoy: { long: 'Hoy', short: 'Hoy' },
  atrasados: { long: 'Atrasados', short: 'Atrasados' },
  porCobrar: { long: 'Por cobrar', short: 'Por cobrar' },
  recordatorios: { long: 'Recordatorios', short: 'Recordat.' },
};

const VER_TODOS: Record<DayQueueFilter, { href: string; label: string }> = {
  hoy: { href: '/tickets?finished=no', label: 'Ver tickets sin terminar' },
  atrasados: { href: '/tickets?finished=no', label: 'Ver tickets sin terminar' },
  porCobrar: { href: '/cobranza', label: 'Ver cobranza' },
  recordatorios: { href: '/service-schedules', label: 'Ver recordatorios' },
};

const PRIMARY_PILL =
  'min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold sm:min-h-9 sm:px-4';

const ROW_CLASS =
  'flex items-center gap-3 border-t border-border/50 px-4 py-3 first:border-t-0 sm:px-5';

const ageChipClass = (tone: 'warn' | 'muted') =>
  cn(
    'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
    tone === 'warn'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
      : 'bg-muted text-muted-foreground',
  );

const RowText = ({
  title,
  context,
  badge,
}: {
  title: string;
  context: React.ReactNode;
  badge?: React.ReactNode;
}) => (
  <div className="min-w-0 flex-1 space-y-0.5">
    <p className="truncate text-sm font-semibold text-foreground">{title}</p>
    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <span className="truncate">{context}</span>
      {badge}
    </div>
  </div>
);

type MoreItem = { label: string; href?: string; onSelect?: () => void };

const MoreMenu = ({ label, items }: { label: string; items: MoreItem[] }) => {
  if (items.length === 0) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full sm:h-9 sm:w-9"
          aria-label={label}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) =>
          item.href ? (
            <DropdownMenuItem key={item.label} asChild>
              <a href={item.href}>{item.label}</a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
              {item.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const telHref = (phone: string | null | undefined) => {
  const digits = phone?.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
};

type SendRequest = { job: FieldJobSnapshot; highlightId?: FieldSendOptionId };

const TicketRow = ({
  item,
  overdue,
  canWrite,
  companyId,
  companyName,
  onSend,
}: {
  item: MergedTechnicianDayTicket;
  overdue: boolean;
  canWrite: boolean;
  companyId: number | null;
  companyName: string | null;
  onSend: (request: SendRequest) => void;
}) => {
  const localOnly = Boolean(item.pendingSync && item.localJobId);
  const clientName = item.clientName?.trim() || 'Cliente sin nombre';
  const context =
    item.servicesSummary ??
    (localOnly
      ? 'Captura rápida'
      : `#${item.id} · ${format(new Date(item.ticketDate), 'd MMM', { locale: es })}`);
  const call = telHref(item.clientTel);
  const job = toFieldJobSnapshotFromDayTicket(item, {
    companyId,
    companyName,
    localJobId: item.localJobId,
    pendingSync: item.pendingSync,
  });

  return (
    <li className={ROW_CLASS}>
      <RowText
        title={clientName}
        context={context}
        badge={
          item.pendingSync && item.syncStatus ? (
            <SyncStatusBadge status={item.syncStatus} />
          ) : null
        }
      />
      {overdue ? (
        <span className={ageChipClass('warn')}>{daysLate(item.ticketDate)} d</span>
      ) : (item.total ?? 0) > 0 ? (
        <span className="hidden shrink-0 text-sm font-semibold tabular-nums sm:inline">
          {formatTicketListAmount(item.total ?? 0)}
        </span>
      ) : null}
      {localOnly ? null : (
        <Button asChild size="sm" className={PRIMARY_PILL}>
          <Link
            href={
              overdue && canWrite ? `/tickets/${item.id}#finalizar` : `/tickets/${item.id}`
            }
          >
            {overdue && canWrite ? 'Finalizar' : 'Abrir'}
          </Link>
        </Button>
      )}
      <MoreMenu
        label={`Más acciones para ${clientName}`}
        items={[
          { label: 'Enviar por WhatsApp…', onSelect: () => onSend({ job }) },
          ...(call ? [{ label: 'Llamar', href: call }] : []),
        ]}
      />
    </li>
  );
};

const CobroRow = ({
  row,
  canWrite,
  companyName,
  onCollect,
  onSend,
}: {
  row: CobranzaRow;
  canWrite: boolean;
  companyName: string | null;
  onCollect: (row: CobranzaRow) => void;
  onSend: (request: SendRequest) => void;
}) => {
  const clientName = row.client_name?.trim() || 'Cliente sin nombre';
  const share = buildWhatsAppBalanceShare({
    phone: row.client_tel,
    clientName: row.client_name,
    ticketId: row.id,
    balanceDue: row.balanceDue,
    companyName,
  });
  const call = telHref(row.client_tel);
  const status = row.paymentStatus === 'partial' ? 'parcial' : 'pendiente';

  return (
    <li className={ROW_CLASS}>
      <RowText
        title={clientName}
        context={`#${row.id} · ${row.daysOutstanding} d · ${status}`}
      />
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {formatTicketListAmount(row.balanceDue)}
      </span>
      {canWrite ? (
        <Button
          type="button"
          size="sm"
          className={PRIMARY_PILL}
          onClick={() => onCollect(row)}
          aria-label={`Cobrar ticket ${row.id}`}
        >
          <Banknote className="h-4 w-4" aria-hidden data-icon="inline-start" />
          Cobrar
        </Button>
      ) : null}
      {share ? (
        <Button
          asChild
          variant="outline"
          size="icon"
          className="hidden h-9 w-9 shrink-0 rounded-full sm:inline-flex"
          aria-label={`WhatsApp saldo ticket ${row.id}`}
        >
          <a href={share.href} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" aria-hidden />
          </a>
        </Button>
      ) : null}
      <MoreMenu
        label={`Más acciones para ${clientName}`}
        items={[
          {
            label: 'Enviar por WhatsApp…',
            onSelect: () =>
              onSend({
                job: toFieldJobSnapshotFromCobranzaRow(row, { companyName }),
                highlightId: 'recordar_saldo',
              }),
          },
          ...(call ? [{ label: 'Llamar', href: call }] : []),
          { label: 'Ver ticket', href: `/tickets/${row.id}` },
        ]}
      />
    </li>
  );
};

const ScheduleRow = ({
  row,
  canWrite,
}: {
  row: DayQueueScheduleRow;
  canWrite: boolean;
}) => {
  const call = telHref(row.clientPhone);
  return (
    <li className={ROW_CLASS}>
      <RowText title={row.clientName} context={row.serviceName} />
      <span className={ageChipClass(row.overdue ? 'warn' : 'muted')}>
        {format(new Date(row.nextDueAt), 'd MMM', { locale: es })}
      </span>
      {canWrite ? (
        <Button asChild size="sm" className={PRIMARY_PILL}>
          <Link
            href={`/tickets/create?clientId=${row.clientId}&serviceId=${row.serviceId}`}
          >
            Crear ticket
          </Link>
        </Button>
      ) : null}
      <MoreMenu
        label={`Más acciones para ${row.clientName}`}
        items={[
          ...(call ? [{ label: 'Llamar', href: call }] : []),
          { label: 'Ver recordatorios', href: '/service-schedules' },
        ]}
      />
    </li>
  );
};

const EMPTY_COPY: Record<DayQueueFilter, { title: string; description: string }> = {
  hoy: {
    title: 'Nada para hoy',
    description: 'No hay tickets sin terminar con fecha de hoy.',
  },
  atrasados: {
    title: 'Sin trabajos atrasados',
    description: 'Todo lo de días anteriores ya está finalizado.',
  },
  porCobrar: {
    title: 'Todo cobrado',
    description: 'Ningún ticket finalizado tiene saldo pendiente.',
  },
  recordatorios: {
    title: 'Sin recordatorios cercanos',
    description: 'Nada atrasado ni en los próximos 14 días.',
  },
};

export type DashboardTuDiaProps = {
  initialQueue: DashboardDayQueue | null;
  /** Campo: Hoy is always the first tab shown. */
  campo?: boolean;
  /** Extra header content (campo money chips). */
  headerExtra?: React.ReactNode;
  className?: string;
};

export const DashboardTuDia = ({
  initialQueue,
  campo = false,
  headerExtra,
  className,
}: DashboardTuDiaProps) => {
  const { selectedCompany } = useCompany();
  const { can, isSystem, loading: permissionsLoading } = usePermissions();
  const canWrite = canWriteTickets(can);
  const showReminders = canReadServiceSchedules(can);
  const missingCompany = needsSelectedCompanyContext(isSystem, selectedCompany?.id);
  const companyId = selectedCompany?.id ?? null;
  const companyName = selectedCompany?.name ?? null;

  const [queue, setQueue] = React.useState<DashboardDayQueue | null>(initialQueue);
  const [loading, setLoading] = React.useState(initialQueue == null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<DayQueueFilter | null>(null);
  const [collectRow, setCollectRow] = React.useState<CobranzaRow | null>(null);
  const [sendRequest, setSendRequest] = React.useState<SendRequest | null>(null);

  const localStore = useFieldJobStore(companyId, !missingCompany);
  const fieldSync = useFieldJobSync(companyId, !missingCompany);

  // Tenants get the queue with the page; system operators load the company they pick.
  const needsFetch = initialQueue == null || isSystem;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getDashboardDayQueue(isSystem ? companyId : undefined);
    setLoading(false);
    if (!result.success || !result.data) {
      setError(getErrorDisplayMessage(result, 'No se pudo cargar tu día'));
      return;
    }
    setQueue(result.data);
  }, [companyId, isSystem]);

  React.useEffect(() => {
    if (permissionsLoading || missingCompany || !needsFetch) {
      return;
    }
    void load();
  }, [load, missingCompany, needsFetch, permissionsLoading]);

  const hoyRows = React.useMemo(
    () => mergeTechnicianDayWithLocalJobs(queue?.hoy ?? [], localStore.jobs),
    [localStore.jobs, queue?.hoy],
  );
  const localExtra = hoyRows.length - (queue?.hoy.length ?? 0);

  const counts: Record<DayQueueFilter, number> = {
    hoy: (queue?.counts.hoy ?? 0) + Math.max(0, localExtra),
    atrasados: queue?.counts.atrasados ?? 0,
    porCobrar: queue?.counts.porCobrar ?? 0,
    recordatorios: queue?.counts.recordatorios ?? 0,
  };
  const filters = DAY_QUEUE_FILTERS.filter(
    (filter) => filter !== 'recordatorios' || showReminders,
  );
  const defaultFilter = campo ? 'hoy' : pickDefaultDayQueueFilter(counts);
  const active = selected ?? (filters.includes(defaultFilter) ? defaultFilter : 'hoy');

  if (missingCompany) {
    return null;
  }

  const today = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
  const panelId = 'dashboard-tu-dia-panel';

  const renderRows = () => {
    switch (active) {
      case 'hoy':
        return hoyRows.slice(0, 5).map((item) => (
          <TicketRow
            key={item.localJobId ?? item.id}
            item={item}
            overdue={false}
            canWrite={canWrite}
            companyId={companyId}
            companyName={companyName}
            onSend={setSendRequest}
          />
        ));
      case 'atrasados':
        return (queue?.atrasados ?? []).map((item) => (
          <TicketRow
            key={item.id}
            item={item}
            overdue
            canWrite={canWrite}
            companyId={companyId}
            companyName={companyName}
            onSend={setSendRequest}
          />
        ));
      case 'porCobrar':
        return (queue?.porCobrar ?? []).map((row) => (
          <CobroRow
            key={row.id}
            row={row}
            canWrite={canWrite}
            companyName={companyName}
            onCollect={setCollectRow}
            onSend={setSendRequest}
          />
        ));
      case 'recordatorios':
        return (queue?.recordatorios ?? []).map((row) => (
          <ScheduleRow key={row.id} row={row} canWrite={canWrite} />
        ));
    }
  };

  const rows = renderRows();
  const verTodos = VER_TODOS[active];

  return (
    <section
      aria-label="Tu día"
      data-testid="dashboard-tu-dia"
      className={cn(
        DASHBOARD_CARD_CLASS,
        'flex min-w-0 flex-col overflow-hidden rounded-xl border',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold tracking-tight sm:text-lg">Tu día</h2>
          <span className="text-xs text-muted-foreground first-letter:uppercase" suppressHydrationWarning>
            {today}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerExtra}
          <FieldSyncNowButton
            pendingCount={fieldSync.pendingCount}
            syncing={fieldSync.syncing}
            onFlush={() =>
              fieldSync.flushNow().then(() => {
                localStore.reload();
                void load();
              })
            }
          />
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Filtros de tu día"
        className={cn(
          'grid gap-1.5 px-3 pb-3 pt-3 sm:gap-2 sm:px-4',
          filters.length === 4 ? 'grid-cols-4' : 'grid-cols-3',
        )}
      >
        {filters.map((filter) => {
          const isActive = filter === active;
          return (
            <button
              key={filter}
              type="button"
              role="tab"
              id={`tu-dia-tab-${filter}`}
              aria-selected={isActive}
              aria-controls={panelId}
              onClick={() => setSelected(filter)}
              className={cn(
                'flex min-h-14 min-w-0 flex-col items-start justify-center rounded-xl border px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3',
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/60 bg-background hover:bg-muted/40',
              )}
            >
              <span className="text-xl font-bold leading-tight tabular-nums sm:text-2xl">
                {loading && !queue ? '–' : counts[filter]}
              </span>
              <span className="whitespace-nowrap text-[11px] font-semibold sm:text-xs">
                <span className="sm:hidden">{TILE_LABELS[filter].short}</span>
                <span className="hidden sm:inline">{TILE_LABELS[filter].long}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`tu-dia-tab-${active}`}
        className="border-t border-border/50"
      >
        {active === 'porCobrar' && counts.porCobrar > 0 ? (
          <p className="px-4 pt-3 text-xs text-muted-foreground sm:px-5">
            {formatTicketListAmount(queue?.porCobrarBalance ?? 0)} por cobrar · más viejo primero
          </p>
        ) : null}
        {loading && !queue ? (
          <div className="space-y-2 p-4" role="status" aria-label="Cargando tu día">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-4/5 rounded-lg" />
          </div>
        ) : error && !queue ? (
          <TripledEmptyState
            icon={<ClipboardList className="h-4 w-4" />}
            title="Error al cargar"
            description={error}
            role="alert"
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                Reintentar
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <div className="p-4">
            <TripledEmptyState
              icon={
                active === 'recordatorios' ? (
                  <CalendarClock className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )
              }
              title={EMPTY_COPY[active].title}
              description={EMPTY_COPY[active].description}
              action={
                active === 'hoy' && canWrite ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/anotar">Anotar</Link>
                  </Button>
                ) : active === 'porCobrar' ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/cobranza">Ir a cobranza</Link>
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <BlurFade key={active} duration={0.2} offset={4}>
            <ul aria-label={`Tu día: ${TILE_LABELS[active].long}`}>{rows}</ul>
          </BlurFade>
        )}
        <Link
          href={verTodos.href}
          className="flex min-h-11 items-center justify-center border-t border-border/50 text-sm font-semibold text-primary hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {verTodos.label} →
        </Link>
      </div>

      {collectRow ? (
        <TicketListCollectPaymentDialog
          open
          onOpenChange={(next) => {
            if (!next) setCollectRow(null);
          }}
          ticketId={Number(collectRow.id)}
          total={collectRow.total}
          paid={collectRow.paid}
          companyId={collectRow.company_id}
          onPaymentApplied={() => {
            setCollectRow(null);
            void load();
          }}
        />
      ) : null}

      {sendRequest ? (
        <JobWhatsAppSendMenu
          job={sendRequest.job}
          highlightId={sendRequest.highlightId}
          showTrigger={false}
          open
          onOpenChange={(next) => {
            if (!next) setSendRequest(null);
          }}
        />
      ) : null}
    </section>
  );
};
