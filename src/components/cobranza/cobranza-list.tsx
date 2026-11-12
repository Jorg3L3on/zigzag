'use client';

import * as React from 'react';
import { Banknote } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getCobranzaList } from '@/actions/cobranza';
import { cobranzaRowToTicketActions } from '@/components/cobranza/cobranza-columns';
import { CobranzaFilterBar } from '@/components/cobranza/cobranza-filter-bar';
import { CobranzaWhatsAppButton } from '@/components/cobranza/cobranza-whatsapp-button';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormattedCurrency } from '@/components/formatted-currency';
import { FormattedDate } from '@/components/formatted-date';
import {
  TicketListCollectPaymentDialog,
  type TicketListCollectPaymentResult,
} from '@/components/tickets/ticket-list-collect-payment-dialog';
import { TicketListPaymentSummary } from '@/components/tickets/ticket-list-payment-summary';
import { TicketRowActions } from '@/components/tickets/ticket-row-actions';
import {
  TripledEmptyState,
  TripledListLoadingState,
  TripledMobileRecordCard,
} from '@/components/tripled';
import { SystemCompanyContextEmptyState } from '@/components/system-company-context-empty-state';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import {
  applyCobranzaPaymentToRows,
  COBRANZA_AGING_LABEL,
  COBRANZA_SORT_OPTIONS,
  COBRANZA_STATUS_FILTER_LABEL,
  filterCobranzaRows,
  isCobranzaAgingBucket,
  isCobranzaStatusFilter,
  sortCobranzaRows,
  summarizeCobranzaRows,
  type CobranzaAgingBucket,
  type CobranzaRow,
  type CobranzaSort,
  type CobranzaStatusFilter,
} from '@/lib/cobranza';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import { resolveResourceListState } from '@/lib/resource-list-state';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { formatTicketListAmount } from '@/lib/ticket-payment-status';
import { canWriteTickets } from '@/lib/tickets-rbac';
import { PERMISSIONS } from '@/lib/permissions';

type CobranzaListProps = {
  /** False while another layout owns the viewport: nothing loads (CobranzaView). */
  enabled?: boolean;
};

/** Cobranza below lg: the cards of ZIG-I18-2, fed by the ZIG-I31 rules. */
export const CobranzaList = ({ enabled = true }: CobranzaListProps) => {
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const canRead = permissions.can(PERMISSIONS.tickets.read);
  const canWrite = canWriteTickets(permissions.can);
  const missingCompany = needsSelectedCompanyContext(
    permissions.isSystem,
    selectedCompany?.id,
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [rows, setRows] = React.useState<CobranzaRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<CobranzaStatusFilter>(
    () => {
      const raw = searchParams.get('status');
      return raw && isCobranzaStatusFilter(raw) ? raw : 'all';
    },
  );
  const [agingFilter, setAgingFilter] = React.useState<CobranzaAgingBucket>(
    () => {
      const raw = searchParams.get('aging');
      return raw && isCobranzaAgingBucket(raw) ? raw : 'all';
    },
  );
  const clientIdParam = searchParams.get('clientId');
  const clientIdFilter =
    clientIdParam && /^\d+$/.test(clientIdParam) ? Number(clientIdParam) : null;
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [sortOrder, setSortOrder] = React.useState<CobranzaSort>('days');
  const [collectRow, setCollectRow] = React.useState<CobranzaRow | null>(null);

  React.useEffect(() => {
    const statusRaw = searchParams.get('status');
    setStatusFilter(
      statusRaw && isCobranzaStatusFilter(statusRaw) ? statusRaw : 'all',
    );
    const agingRaw = searchParams.get('aging');
    setAgingFilter(
      agingRaw && isCobranzaAgingBucket(agingRaw) ? agingRaw : 'all',
    );
  }, [searchParams]);

  React.useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (statusFilter === 'all') {
      params.delete('status');
    } else {
      params.set('status', statusFilter);
    }
    if (agingFilter === 'all') {
      params.delete('aging');
    } else {
      params.set('aging', agingFilter);
    }
    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) {
      return;
    }
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [agingFilter, pathname, router, searchParams, statusFilter]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(searchValue.trim().toLowerCase()),
      250,
    );
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const loadCobranza = React.useCallback(async () => {
    if (!enabled) return;
    if (!canRead || missingCompany) {
      setLoading(false);
      setRows([]);
      setLoadError(
        missingCompany
          ? 'Selecciona una empresa para ver la cobranza.'
          : null,
      );
      return;
    }

    setLoading(true);
    setLoadError(null);
    const result = await getCobranzaList(selectedCompany?.id ?? null);
    setLoading(false);
    if (!result.success || !result.data) {
      const errorType = classifyClientError(null, undefined, result.errorType);
      const message = getErrorMessageByType(
        errorType,
        result.error || 'No se pudo cargar la cobranza',
      );
      setLoadError(message);
      setRows([]);
      toast.error(message);
      return;
    }

    setRows(result.data.rows);
  }, [canRead, enabled, missingCompany, selectedCompany?.id]);

  React.useEffect(() => {
    void loadCobranza();
  }, [loadCobranza]);

  const hasActiveFilters =
    clientIdFilter != null ||
    statusFilter !== 'all' ||
    agingFilter !== 'all' ||
    debouncedSearch.length > 0;

  const sheetFilterCount = [
    statusFilter !== 'all',
    agingFilter !== 'all',
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setAgingFilter('all');
  };

  const filteredRows = React.useMemo(
    () =>
      sortCobranzaRows(
        filterCobranzaRows(rows, {
          status: statusFilter,
          aging: agingFilter,
          search: debouncedSearch,
          clientId: clientIdFilter,
        }),
        sortOrder,
      ),
    [agingFilter, clientIdFilter, debouncedSearch, rows, sortOrder, statusFilter],
  );

  const summary = React.useMemo(
    () => summarizeCobranzaRows(filteredRows),
    [filteredRows],
  );

  const filterChips = [
    {
      key: 'count',
      label: `${filteredRows.length} de ${rows.length} tickets`,
      variant: 'secondary' as const,
    },
    ...(statusFilter !== 'all'
      ? [{ key: 'status', label: COBRANZA_STATUS_FILTER_LABEL[statusFilter] }]
      : []),
    ...(agingFilter !== 'all'
      ? [{ key: 'aging', label: COBRANZA_AGING_LABEL[agingFilter] }]
      : []),
    ...(debouncedSearch
      ? [{ key: 'search', label: `Búsqueda: ${debouncedSearch}` }]
      : []),
  ];

  const handlePaymentApplied = React.useCallback(
    (result: TicketListCollectPaymentResult) => {
      setRows((prev) => applyCobranzaPaymentToRows(prev, result));
    },
    [],
  );

  const listState = resolveResourceListState({
    isLoading: loading,
    loadError,
    totalCount: rows.length,
    visibleCount: filteredRows.length,
    hasActiveFilters,
  });

  if (missingCompany) {
    return <SystemCompanyContextEmptyState />;
  }

  if (!permissions.loading && !canRead) {
    return (
      <TripledEmptyState
        icon={<Banknote className="size-8" aria-hidden />}
        title="Sin acceso"
        description="No tienes permiso para ver la cobranza."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3"
        data-testid="cobranza-summary"
        role="status"
      >
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">
            {summary.count}
          </span>{' '}
          {summary.count === 1 ? 'ticket con saldo' : 'tickets con saldo'}
        </p>
        <p className="text-sm font-semibold tabular-nums text-amber-800 dark:text-amber-300">
          Total por cobrar:{' '}
          <FormattedCurrency amount={summary.balanceSum} />
        </p>
      </div>

      {clientIdFilter != null ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-sm"
          data-testid="cobranza-client-filter"
        >
          <p>
            Cliente:{' '}
            <Link
              href={`/clients/${clientIdFilter}`}
              className="inline-flex min-h-11 min-w-11 items-center font-semibold underline-offset-4 hover:underline"
            >
              {rows.find((row) => row.client_id === clientIdFilter)?.client_name ??
                `#${clientIdFilter}`}
            </Link>
          </p>
          <Link
            href="/cobranza"
            className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver todos los clientes
          </Link>
        </div>
      ) : null}

      <CobranzaFilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        agingFilter={agingFilter}
        onAgingFilterChange={setAgingFilter}
        sheetFilterCount={sheetFilterCount}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        filterChips={filterChips}
      />

      <div className="flex items-center gap-3">
        <label htmlFor="cobranza-sort" className="shrink-0 text-base font-medium">
          Ordenar
        </label>
        <Select
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as CobranzaSort)}
        >
          <SelectTrigger id="cobranza-sort" className="h-12 flex-1 rounded-xl text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COBRANZA_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="py-3 text-base">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {listState.kind === 'loading' ? (
        <TripledListLoadingState label="Cargando cobranza…" />
      ) : null}

      {listState.kind === 'error' ? (
        <TripledEmptyState
          icon={<Banknote className="size-8" aria-hidden />}
          title="No se pudo cargar"
          description={listState.message}
        />
      ) : null}

      {listState.kind === 'empty' ? (
        <TripledEmptyState
          icon={<Banknote className="size-8" aria-hidden />}
          title="No hay saldos pendientes"
          description="Todos tus tickets están pagados."
        />
      ) : null}

      {listState.kind === 'filtered-empty' ? (
        <TripledEmptyState
          icon={<Banknote className="size-8" aria-hidden />}
          title="Sin resultados"
          description="Ningún ticket coincide con los filtros actuales."
        />
      ) : null}

      {listState.kind === 'ready' ? (
        <>
          <div className="flex flex-col gap-3">
            {filteredRows.map((item) => {
              return (
                <TripledMobileRecordCard key={item.id}>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold leading-tight">
                          {item.client_id != null ? (
                            <Link
                              href={`/clients/${item.client_id}`}
                              className="inline-flex min-h-11 min-w-11 items-center underline-offset-4 hover:underline"
                            >
                              {item.client_name ?? 'Sin cliente'}
                            </Link>
                          ) : (
                            (item.client_name ?? 'Sin cliente')
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Ticket {item.folio}
                        </p>
                      </div>
                      <div
                        className="flex items-center"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <TicketRowActions
                          ticket={cobranzaRowToTicketActions(item)}
                          onPaymentApplied={handlePaymentApplied}
                          canWrite={canWrite}
                          companyId={selectedCompany?.id ?? null}
                        />
                      </div>
                    </div>
                    {item.services_summary ? (
                      <p
                        className="line-clamp-1 text-base text-foreground"
                        data-testid="cobranza-services"
                      >
                        {item.services_summary}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <FormattedDate
                        date={
                          item.ticket_date
                            ? new Date(item.ticket_date)
                            : new Date(item.created_at)
                        }
                      />
                      <span className="text-muted-foreground">
                        {item.daysOutstanding === 0
                          ? 'Hoy'
                          : `${item.daysOutstanding} ${item.daysOutstanding === 1 ? 'día' : 'días'} sin pagar`}
                      </span>
                    </div>
                    <TicketListPaymentSummary
                      total={item.total}
                      paid={item.paid}
                    />
                    <p className="text-sm font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                      Saldo {formatTicketListAmount(item.balanceDue)}
                    </p>
                    <div className="grid gap-2">
                      {canWrite ? (
                        <Button
                          type="button"
                          className="h-12 w-full gap-2 rounded-xl text-base font-semibold"
                          onClick={() => setCollectRow(item)}
                        >
                          <Banknote className="h-5 w-5" aria-hidden />
                          Cobrar
                        </Button>
                      ) : null}
                      <CobranzaWhatsAppButton
                        row={item}
                        companyName={selectedCompany?.name ?? null}
                        variant="card"
                      />
                    </div>
                  </div>
                </TripledMobileRecordCard>
              );
            })}
          </div>
        </>
      ) : null}

      {collectRow ? (
        <TicketListCollectPaymentDialog
          open
          onOpenChange={(open) => {
            if (!open) setCollectRow(null);
          }}
          ticketId={Number(collectRow.id)}
          total={collectRow.total}
          paid={collectRow.paid}
          companyId={selectedCompany?.id ?? null}
          folio={collectRow.folio}
          clientName={collectRow.client_name}
          clientTel={collectRow.client_tel}
          companyName={selectedCompany?.name ?? null}
          onPaymentApplied={handlePaymentApplied}
        />
      ) : null}
    </div>
  );
};
