'use client';

import * as React from 'react';
import {
  getCoreRowModel,
  useReactTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import type { Ticket, TicketListCounts } from '@/actions/tickets';
import { getTicketsPaginated } from '@/actions/tickets';
import { DesktopSwitch } from '@/components/desktop-switch';
import {
  LIST_PAGE_SIZE,
  ListColumnsMenu,
  ListDesktopTitle,
  ListEmpty,
  ListError,
  ListFooter,
  ListLoading,
  ListNoResults,
  ListTable,
  ListTableCard,
  listFooterPagination,
  useListHiddenColumns,
  type ListColumnOption,
} from '@/components/list-page';
import {
  TicketCollectionTabs,
  TicketsDesktopToolbar,
  TicketsFilterBar,
} from '@/components/tickets/tickets-filter-bar';
import {
  buildTicketFilterChips,
  countActiveFilters,
  hasActiveTicketFilters,
} from '@/components/tickets/tickets-list-filter-utils';
import { TicketsListPagination } from '@/components/tickets/tickets-list-pagination';
import { TicketsMobileCard } from '@/components/tickets/tickets-mobile-card';
import { createTicketsColumns } from '@/components/tickets/tickets-columns';
import { MobilePullToRefresh } from '@/components/mobile-pull-to-refresh';
import {
  encodeSortingState,
  parseTicketSortParam,
  ticketListSortForServer,
  ticketSortParam,
} from '@/components/tickets/tickets-sort-presets';
import type {
  FinishedFilterValue,
  StatusFilterValue,
} from '@/components/tickets/tickets-list-types';
import { SystemCompanyContextEmptyState } from '@/components/system-company-context-empty-state';
import { TicketsListSkeleton } from '@/components/tickets/tickets-list-skeleton';
import {
  TripledEmptyState,
  TripledListLoadingState,
} from '@/components/tripled';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { classifyClientError, presentActionError } from '@/lib/network-awareness';
import { endOfDay, startOfDay } from 'date-fns';
import {
  formatOfflineSnapshotBanner,
  readOfflineSnapshot,
  writeOfflineSnapshot,
} from '@/lib/offline-snapshot';
import { resolveResourceListState } from '@/lib/resource-list-state';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { hrefForTicketListRow } from '@/lib/ticket-list-navigation';
import { canWriteTickets } from '@/lib/tickets-rbac';
import { Ticket as TicketIcon, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DateRange } from 'react-day-picker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { parseFinishedFilter, parseStatusFilter } from '@/components/tickets/tickets-list-types';

type FetchTicketsOutcome = { ok: true } | { ok: false; message: string };

/** The one description of the page, as the phone card header reads it (a4aec7d5). */
const TICKETS_DESCRIPTION = 'Lista de todos los tickets registrados';

/** Columnas (canvas ListaA): what a person can hide on the desktop table. */
const TICKET_OPTIONAL_COLUMNS: ListColumnOption[] = [
  { id: 'services', label: 'Trabajo' },
  { id: 'ticket_date', label: 'Fecha' },
  { id: 'total', label: 'Total' },
  { id: 'balance', label: 'Saldo' },
];

export default function TicketsList() {
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const canWrite = canWriteTickets(permissions.can);
  const missingCompany = needsSelectedCompanyContext(
    permissions.isSystem,
    selectedCompany?.id,
  );
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [counts, setCounts] = React.useState<TicketListCounts | null>(null);
  // Por cobrar count for the phone chip, under the ?finished filter as in sandbox (ZIG-I13-7).
  const [dueCount, setDueCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  // The full-page skeleton only covers the first load (and SSR). Once the
  // filter bar has mounted it must stay mounted so typing keeps its focus.
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = React.useState<string | null>(
    null,
  );
  const [searchValue, setSearchValue] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilterValue>(() =>
    parseStatusFilter(searchParams.get('status')),
  );
  const [finishedFilter, setFinishedFilter] =
    React.useState<FinishedFilterValue>(() =>
      parseFinishedFilter(searchParams.get('finished')),
    );
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  // `?orden=`, written by the column headers on desktop and the sort select on phones;
  // the server sorts the whole list, not the page (ZIG-I33-2).
  const [sorting, setSorting] = React.useState<SortingState>(() =>
    parseTicketSortParam(searchParams.get('orden')),
  );
  const sortKey = encodeSortingState(sorting);
  const sortParam = ticketSortParam(sorting);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: LIST_PAGE_SIZE,
  });
  const ticketsRef = React.useRef<Ticket[]>([]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, statusFilter, finishedFilter, dateRange, sortKey]);

  React.useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  React.useEffect(() => {
    setStatusFilter(parseStatusFilter(searchParams.get('status')));
    setFinishedFilter(parseFinishedFilter(searchParams.get('finished')));
    const nextSorting = parseTicketSortParam(searchParams.get('orden'));
    setSorting((prev) =>
      encodeSortingState(prev) === encodeSortingState(nextSorting) ? prev : nextSorting,
    );
  }, [searchParams]);

  React.useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (statusFilter === 'all') {
      params.delete('status');
    } else {
      params.set('status', statusFilter);
    }
    if (finishedFilter === 'all') {
      params.delete('finished');
    } else {
      params.set('finished', finishedFilter);
    }
    if (sortParam) {
      params.set('orden', sortParam);
    } else {
      params.delete('orden');
    }
    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) {
      return;
    }
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [statusFilter, finishedFilter, sortParam, pathname, router, searchParams]);

  const fetchTickets = React.useCallback(
    async ({
      showLoading = true,
    }: { showLoading?: boolean } = {}): Promise<FetchTicketsOutcome> => {
      if (missingCompany) {
        setTickets([]);
        setTotalCount(0);
        setLoadError(null);
        setSnapshotUpdatedAt(null);
        setLoading(false);
        return { ok: true };
      }
      if (!selectedCompany?.id) {
        setSnapshotUpdatedAt(null);
        setLoading(false);
        return { ok: false, message: 'Selecciona una empresa para cargar tickets' };
      }

      if (showLoading) {
        setLoading(true);
      }

      const showOfflineSnapshot = async (): Promise<boolean> => {
        try {
          const snapshot = await readOfflineSnapshot<Ticket[]>(
            'tickets',
            selectedCompany.id,
          );
          if (!snapshot) {
            return false;
          }
          setTickets(snapshot.data);
          ticketsRef.current = snapshot.data;
          setTotalCount(snapshot.data.length);
          setDueCount(null);
          setCounts(null);
          setSnapshotUpdatedAt(snapshot.updatedAt);
          setLoadError(null);
          return true;
        } catch (snapshotError) {
          console.warn('Unable to read tickets offline snapshot:', snapshotError);
          return false;
        }
      };

      const dateFrom = dateRange?.from
        ? startOfDay(dateRange.from).toISOString()
        : undefined;
      const dateTo = dateRange?.from
        ? endOfDay(dateRange.to ?? dateRange.from).toISOString()
        : undefined;

      try {
        const result = await getTicketsPaginated({
          companyId: selectedCompany.id,
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          search: debouncedSearch || undefined,
          statusFilter: statusFilter === 'all' ? 'all' : statusFilter,
          finishedFilter,
          dateFrom,
          dateTo,
          sort: ticketListSortForServer(sorting),
        });
        if (result.success && result.data) {
          const pageItems = result.data.items as Ticket[];
          setTickets(pageItems);
          ticketsRef.current = pageItems;
          setTotalCount(result.data.total);
          setDueCount(result.data.dueCount ?? null);
          setCounts(result.data.counts ?? null);
          setSnapshotUpdatedAt(null);
          setLoadError(null);
          void writeOfflineSnapshot('tickets', selectedCompany.id, pageItems).catch(
            (snapshotError) => {
              console.warn(
                'Unable to write tickets offline snapshot:',
                snapshotError,
              );
            },
          );
          return { ok: true };
        } else if (!result.success) {
          const errorType = classifyClientError(null, undefined, result.errorType);
          if (errorType === 'network' && (await showOfflineSnapshot())) {
            return { ok: true };
          }
          const toastContent = presentActionError(
            result,
            'No se pudieron cargar los tickets',
          );
          const message = toastContent.description;
          setSnapshotUpdatedAt(null);
          setLoadError(
            !showLoading && ticketsRef.current.length > 0 ? null : message,
          );
          return { ok: false, message };
        }
      } catch (error) {
        console.error('Error fetching tickets:', error);
        const errorType = classifyClientError(error);
        if (errorType === 'network' && (await showOfflineSnapshot())) {
          return { ok: true };
        }
        const toastContent = presentActionError(
          null,
          'No se pudieron cargar los tickets',
          errorType,
        );
        const message = toastContent.description;
        setSnapshotUpdatedAt(null);
        setLoadError(!showLoading && ticketsRef.current.length > 0 ? null : message);
        return { ok: false, message };
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }

      return { ok: true };
    },
    [
      missingCompany,
      selectedCompany?.id,
      pagination.pageIndex,
      pagination.pageSize,
      debouncedSearch,
      statusFilter,
      finishedFilter,
      dateRange,
      sorting,
    ],
  );

  React.useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  const pendingDeleteRef = React.useRef<Map<number, Ticket>>(new Map());

  const handleDelete = React.useCallback((id: number) => {
    setTickets((prevTickets) => {
      const found = prevTickets.find((ticket) => Number(ticket.id) === id);
      if (found) {
        pendingDeleteRef.current.set(id, found);
      }
      return prevTickets.filter((ticket) => Number(ticket.id) !== id);
    });
  }, []);

  const handleDeleteFailed = React.useCallback((id: number) => {
    const restored = pendingDeleteRef.current.get(id);
    pendingDeleteRef.current.delete(id);
    if (!restored) return;
    setTickets((prevTickets) => {
      if (prevTickets.some((ticket) => Number(ticket.id) === id)) {
        return prevTickets;
      }
      return [...prevTickets, restored];
    });
  }, []);

  const handlePaymentApplied = React.useCallback(
    (result: { ticketId: number; paid: number; total: number | null }) => {
      setTickets((prevTickets) =>
        prevTickets.map((ticket) =>
          Number(ticket.id) === result.ticketId
            ? { ...ticket, paid: result.paid, total: result.total }
            : ticket,
        ),
      );
    },
    [],
  );

  const columns = React.useMemo(
    () =>
      createTicketsColumns({
        onDelete: handleDelete,
        onDeleteFailed: handleDeleteFailed,
        onPaymentApplied: handlePaymentApplied,
        canWrite,
        companyId: selectedCompany?.id,
      }),
    [
      handleDelete,
      handleDeleteFailed,
      handlePaymentApplied,
      canWrite,
      selectedCompany?.id,
    ],
  );

  const filteredTickets = tickets;

  const hiddenColumns = useListHiddenColumns('zigzag:tickets-columns:v1');
  const table = useReactTable({
    data: filteredTickets,
    columns,
    state: {
      sorting,
      pagination,
      columnVisibility: { client_tel: false, ...hiddenColumns.visibility },
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    // The rows come sorted and paged from the server.
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    pageCount: Math.max(1, Math.ceil(totalCount / pagination.pageSize)),
  });

  const filterState = {
    searchValue,
    statusFilter,
    finishedFilter,
    dateRange,
  };
  const hasActiveFilters = hasActiveTicketFilters(filterState);
  const listState = resolveResourceListState({
    isLoading: loading,
    loadError,
    totalCount,
    visibleCount: filteredTickets.length,
    hasActiveFilters,
  });
  const activeFilterCount = countActiveFilters(filterState);
  const filterChips = buildTicketFilterChips(
    totalCount,
    filteredTickets.length,
    filterState,
  );

  const handleClearFilters = () => {
    setSearchValue('');
    setStatusFilter('all');
    setFinishedFilter('all');
    setDateRange(undefined);
    // Limpiar never touches the order (ZIG-I33 §2).
  };

  const handlePullToRefresh = React.useCallback(async () => {
    const result = await fetchTickets({ showLoading: false });
    if (!result.ok) {
      const content = presentActionError(null, result.message);
      toast.error(content.title, { description: content.description });
    }
  }, [fetchTickets]);

  React.useEffect(() => {
    if (!loading) setHasLoadedOnce(true);
  }, [loading]);

  const visibleRows = table.getRowModel().rows;

  if (missingCompany) {
    return <SystemCompanyContextEmptyState resourceLabel="tickets" />;
  }

  const offlineBanner = snapshotUpdatedAt ? (
    <div
      role="status"
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
    >
      {formatOfflineSnapshotBanner(snapshotUpdatedAt)}. No se puede guardar
      sin conexión.
    </div>
  ) : null;
  // Desktop: the shared Alert, like Clientes (ZIG-I33 §8); phones keep the banner above.
  const offlineAlert = snapshotUpdatedAt ? (
    <Alert
      role="status"
      className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <AlertDescription>
        {formatOfflineSnapshotBanner(snapshotUpdatedAt)}. No se puede guardar sin conexión.
      </AlertDescription>
    </Alert>
  ) : null;

  // Phones (below lg): the cards of ZIG-I13-7, unchanged by ZIG-I33.
  const phone =
    loading && !hasLoadedOnce ? (
      <TicketsListSkeleton />
    ) : (
      <div className="space-y-4">
        <TicketsFilterBar
          dueCount={dueCount}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          finishedFilter={finishedFilter}
          onFinishedFilterChange={setFinishedFilter}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          sorting={sorting}
          onSortingChange={setSorting}
          activeFilterCount={activeFilterCount}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          filterChips={filterChips}
        />

        {offlineBanner}

        <MobilePullToRefresh
          label="Desliza para actualizar tickets"
          onRefresh={handlePullToRefresh}
          testId="tickets-pull-to-refresh"
        >
          {listState.kind === 'loading' ? (
            <TripledListLoadingState
              label="Cargando tickets"
              desktopColumns={7}
              desktopRows={8}
              mobileCards={4}
            />
          ) : listState.kind === 'error' ? (
            <TripledEmptyState
              icon={<TicketIcon className="h-4 w-4" />}
              title="Error de carga"
              description={listState.message}
              role="alert"
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    void fetchTickets();
                  }}
                >
                  Reintentar
                </Button>
              }
            />
          ) : listState.kind === 'empty' ? (
            <TripledEmptyState
              icon={<TicketIcon className="h-4 w-4" />}
              title="Sin tickets"
              description={
                canWrite
                  ? 'Crea el primer ticket para empezar a registrar servicios, pagos y comprobantes.'
                  : 'No hay tickets registrados aún.'
              }
              action={
                canWrite ? (
                  <Button
                    type="button"
                    onClick={() => router.push('/tickets/create')}
                  >
                    Crear ticket
                  </Button>
                ) : null
              }
            />
          ) : listState.kind === 'filtered-empty' ? (
            <TripledEmptyState
              icon={<TicketIcon className="h-4 w-4" />}
              title="Sin resultados"
              description="No hay tickets que coincidan con la búsqueda o los filtros seleccionados."
              action={
                <Button type="button" variant="outline" onClick={handleClearFilters}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <>
              <div className="space-y-2.5">
                {visibleRows.map((row) => (
                  <TicketsMobileCard
                    key={row.id}
                    ticket={row.original}
                    canWrite={canWrite}
                    onDelete={handleDelete}
                    onDeleteFailed={handleDeleteFailed}
                    onPaymentApplied={handlePaymentApplied}
                    companyId={selectedCompany?.id}
                  />
                ))}
              </div>
              <TicketsListPagination table={table} />
            </>
          )}
        </MobilePullToRefresh>
      </div>
    );

  // From lg (ZIG-I33-2): a refresh keeps the rows, dimmed; the skeleton is the first load only.
  let desktopBody: React.ReactNode;
  if (loading && !hasLoadedOnce) {
    desktopBody = <ListLoading label="Cargando tickets" columns={7} />;
  } else if (loadError) {
    desktopBody = <ListError description={loadError} onRetry={() => void fetchTickets()} />;
  } else if (filteredTickets.length === 0 && totalCount === 0) {
    desktopBody = hasActiveFilters ? (
      <ListNoResults
        description="No hay tickets que coincidan con la búsqueda o los filtros seleccionados."
        onClear={handleClearFilters}
      />
    ) : (
      <ListEmpty
        title="Sin tickets"
        description={
          canWrite
            ? 'Crea el primer ticket para empezar a registrar servicios, pagos y comprobantes.'
            : 'No hay tickets registrados aún.'
        }
        action={
          canWrite ? (
            <Button asChild>
              <Link href="/tickets/create">Crear ticket</Link>
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    desktopBody = (
      // Columns follow the list's width, not the viewport (the sidebar takes 256px).
      <ListTableCard
        className="@container"
        footer={
          <ListFooter
            total={totalCount}
            noun="tickets"
            shown={filteredTickets.length}
            pagination={listFooterPagination(table)}
          />
        }
      >
        <ListTable
          table={table}
          ariaLabel="Tickets"
          busy={loading}
          getRowHref={(row) => hrefForTicketListRow(row.original, canWrite)}
          rowTestId="tickets-row"
        />
      </ListTableCard>
    );
  }

  const desktop = (
    <>
      <ListDesktopTitle
        title="Tickets"
        // The whole list, whatever the view (canvas «Tickets · 60»).
        count={hasLoadedOnce ? (counts?.all ?? totalCount) : null}
        description={TICKETS_DESCRIPTION}
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/tickets/create">
                <Plus className="h-4 w-4 shrink-0" aria-hidden data-icon="inline-start" />
                Nuevo ticket
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <TicketCollectionTabs
            statusFilter={statusFilter}
            finishedFilter={finishedFilter}
            counts={counts}
            onStatusFilterChange={setStatusFilter}
            onFinishedFilterChange={setFinishedFilter}
          />
          <TicketsDesktopToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            finishedFilter={finishedFilter}
            onFinishedFilterChange={setFinishedFilter}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
            columnsMenu={
              <ListColumnsMenu table={table} options={TICKET_OPTIONAL_COLUMNS} onToggle={hiddenColumns.toggle} />
            }
          />
        </div>
        {offlineAlert}
        {desktopBody}
      </div>
    </>
  );

  return <DesktopSwitch phone={phone} desktop={desktop} />;
}
