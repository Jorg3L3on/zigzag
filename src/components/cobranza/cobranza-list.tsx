'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { Banknote } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getCobranzaList } from '@/actions/cobranza';
import {
  cobranzaRowToTicketActions,
  createCobranzaColumns,
} from '@/components/cobranza/cobranza-columns';
import { CobranzaFilterBar } from '@/components/cobranza/cobranza-filter-bar';
import { CobranzaWhatsAppButton } from '@/components/cobranza/cobranza-whatsapp-button';
import { FormattedCurrency } from '@/components/formatted-currency';
import { FormattedDate } from '@/components/formatted-date';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TicketListCollectPaymentResult } from '@/components/tickets/ticket-list-collect-payment-dialog';
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
  COBRANZA_STATUS_FILTER_LABEL,
  filterCobranzaRows,
  isCobranzaAgingBucket,
  isCobranzaStatusFilter,
  summarizeCobranzaRows,
  type CobranzaAgingBucket,
  type CobranzaRow,
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
export const CobranzaList = () => {
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
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [sorting, setSorting] = React.useState<SortingState>([]);

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
  }, [canRead, missingCompany, selectedCompany?.id]);

  React.useEffect(() => {
    void loadCobranza();
  }, [loadCobranza]);

  const hasActiveFilters =
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
      filterCobranzaRows(rows, {
        status: statusFilter,
        aging: agingFilter,
        search: debouncedSearch,
      }),
    [agingFilter, debouncedSearch, rows, statusFilter],
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

  const columns = React.useMemo(
    () =>
      createCobranzaColumns({
        onPaymentApplied: handlePaymentApplied,
        canWrite,
        companyId: selectedCompany?.id ?? null,
        companyName: selectedCompany?.name ?? null,
      }),
    [canWrite, handlePaymentApplied, selectedCompany?.id, selectedCompany?.name],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
          description="Todos los tickets de esta empresa están saldados o no hay cobros por registrar."
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
          <div className="hidden overflow-hidden rounded-xl border border-border/70 shadow-sm md:block">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {table.getRowModel().rows.map((row) => {
              const item = row.original;
              return (
                <TripledMobileRecordCard key={item.id}>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold leading-tight">
                          {item.client_name ?? 'Sin cliente'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Ticket #{item.id}
                        </p>
                      </div>
                      <div
                        className="flex items-center gap-0.5"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <CobranzaWhatsAppButton
                          row={item}
                          companyName={selectedCompany?.name ?? null}
                        />
                        <TicketRowActions
                          ticket={cobranzaRowToTicketActions(item)}
                          onPaymentApplied={handlePaymentApplied}
                          canWrite={canWrite}
                          companyId={selectedCompany?.id ?? null}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <FormattedDate
                        date={
                          item.ticket_date
                            ? new Date(item.ticket_date)
                            : new Date(item.created_at)
                        }
                      />
                      <span className="text-muted-foreground">
                        {item.daysOutstanding}{' '}
                        {item.daysOutstanding === 1 ? 'día' : 'días'}
                      </span>
                    </div>
                    <TicketListPaymentSummary
                      total={item.total}
                      paid={item.paid}
                    />
                    <p className="text-sm font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                      Saldo {formatTicketListAmount(item.balanceDue)}
                    </p>
                  </div>
                </TripledMobileRecordCard>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
};
