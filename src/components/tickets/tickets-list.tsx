'use client';

import * as React from 'react';
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import type { Ticket } from '@/actions/tickets';
import { getTicketsList } from '@/actions/tickets';
import { TicketsFilterBar } from '@/components/tickets/tickets-filter-bar';
import {
  buildTicketFilterChips,
  countActiveFilters,
  filterTickets,
  hasActiveTicketFilters,
} from '@/components/tickets/tickets-list-filter-utils';
import { TicketsListPagination } from '@/components/tickets/tickets-list-pagination';
import { TicketsListSkeleton } from '@/components/tickets/tickets-list-skeleton';
import { TicketsListTable } from '@/components/tickets/tickets-list-table';
import { TicketsMobileCard } from '@/components/tickets/tickets-mobile-card';
import { createTicketsColumns } from '@/components/tickets/tickets-columns';
import { MobilePullToRefresh } from '@/components/mobile-pull-to-refresh';
import { DEFAULT_TICKET_SORTING } from '@/components/tickets/tickets-sort-presets';
import type {
  FinishedFilterValue,
  StatusFilterValue,
} from '@/components/tickets/tickets-list-types';
import { SystemCompanyContextEmptyState } from '@/components/system-company-context-empty-state';
import { TripledEmptyState } from '@/components/tripled';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import {
  formatOfflineSnapshotBanner,
  readOfflineSnapshot,
  writeOfflineSnapshot,
} from '@/lib/offline-snapshot';
import { resolveResourceListState } from '@/lib/resource-list-state';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { canWriteTickets } from '@/lib/tickets-rbac';
import { Ticket as TicketIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type FetchTicketsOutcome = { ok: true } | { ok: false; message: string };

const parseStatusFilter = (value: string | null): StatusFilterValue => {
  if (value === 'paid' || value === 'partial' || value === 'pending') {
    return value;
  }
  return 'all';
};

const parseFinishedFilter = (value: string | null): FinishedFilterValue => {
  if (value === 'yes' || value === 'no') {
    return value;
  }
  return 'all';
};

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
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
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
  const [sorting, setSorting] =
    React.useState<SortingState>(DEFAULT_TICKET_SORTING);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const ticketsRef = React.useRef<Ticket[]>([]);

  React.useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  React.useEffect(() => {
    setStatusFilter(parseStatusFilter(searchParams.get('status')));
    setFinishedFilter(parseFinishedFilter(searchParams.get('finished')));
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
    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) {
      return;
    }
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [statusFilter, finishedFilter, pathname, router, searchParams]);

  const fetchTickets = React.useCallback(
    async ({
      showLoading = true,
    }: { showLoading?: boolean } = {}): Promise<FetchTicketsOutcome> => {
      if (missingCompany) {
        setTickets([]);
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
          setSnapshotUpdatedAt(snapshot.updatedAt);
          setLoadError(null);
          return true;
        } catch (snapshotError) {
          console.warn('Unable to read tickets offline snapshot:', snapshotError);
          return false;
        }
      };

      try {
        const result = await getTicketsList(selectedCompany.id);
        if (result.success && result.data) {
          setTickets(result.data);
          ticketsRef.current = result.data;
          setSnapshotUpdatedAt(null);
          setLoadError(null);
          void writeOfflineSnapshot('tickets', selectedCompany.id, result.data).catch(
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
          const message = getErrorMessageByType(
            errorType,
            result.error || 'No se pudieron cargar los tickets',
          );
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
        const message = getErrorMessageByType(
          errorType,
          'No se pudieron cargar los tickets',
        );
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
    [missingCompany, selectedCompany?.id],
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

  const filteredTickets = React.useMemo(
    () =>
      filterTickets(tickets, {
        searchValue,
        statusFilter,
        finishedFilter,
        dateRange,
      }),
    [tickets, searchValue, statusFilter, finishedFilter, dateRange],
  );

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [searchValue, statusFilter, finishedFilter, dateRange]);

  const table = useReactTable({
    data: filteredTickets,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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
    totalCount: tickets.length,
    visibleCount: filteredTickets.length,
    hasActiveFilters,
  });
  const activeFilterCount = countActiveFilters(filterState);
  const filterChips = buildTicketFilterChips(
    tickets,
    filteredTickets.length,
    filterState,
  );

  const handleClearFilters = () => {
    setSearchValue('');
    setStatusFilter('all');
    setFinishedFilter('all');
    setDateRange(undefined);
    setSorting(DEFAULT_TICKET_SORTING);
  };

  const handlePullToRefresh = React.useCallback(async () => {
    const result = await fetchTickets({ showLoading: false });
    if (!result.ok) {
      toast.error(result.message);
    }
  }, [fetchTickets]);

  const visibleRows = table.getRowModel().rows;

  if (missingCompany) {
    return <SystemCompanyContextEmptyState resourceLabel="tickets" />;
  }

  if (loading) {
    return <TicketsListSkeleton />;
  }

  return (
    <div className="space-y-4">
      <TicketsFilterBar
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

      {snapshotUpdatedAt ? (
        <div
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
        >
          {formatOfflineSnapshotBanner(snapshotUpdatedAt)}. No se puede guardar
          sin conexión.
        </div>
      ) : null}

      <MobilePullToRefresh
        label="Desliza para actualizar tickets"
        onRefresh={handlePullToRefresh}
        testId="tickets-pull-to-refresh"
      >
        {listState.kind === 'error' ? (
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
            <div className="space-y-3 md:hidden">
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

            <TicketsListTable table={table} canWrite={canWrite} />
            <TicketsListPagination table={table} />
          </>
        )}
      </MobilePullToRefresh>
    </div>
  );
}
