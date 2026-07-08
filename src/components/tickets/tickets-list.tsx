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
import { DEFAULT_TICKET_SORTING } from '@/components/tickets/tickets-sort-presets';
import type {
  FinishedFilterValue,
  PdfFilterValue,
  StatusFilterValue,
} from '@/components/tickets/tickets-list-types';
import { SystemCompanyContextEmptyState } from '@/components/system-company-context-empty-state';
import { TripledEmptyState } from '@/components/tripled';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { resolveResourceListState } from '@/lib/resource-list-state';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { canWriteTickets } from '@/lib/tickets-rbac';
import { Ticket as TicketIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';

export default function TicketsList() {
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const canWrite = canWriteTickets(permissions.can);
  const missingCompany = needsSelectedCompanyContext(
    permissions.isSystem,
    selectedCompany?.id,
  );
  const router = useRouter();
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [statusFilter, setStatusFilter] =
    React.useState<StatusFilterValue>('all');
  const [pdfFilter, setPdfFilter] = React.useState<PdfFilterValue>('all');
  const [finishedFilter, setFinishedFilter] =
    React.useState<FinishedFilterValue>('all');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [sorting, setSorting] =
    React.useState<SortingState>(DEFAULT_TICKET_SORTING);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const fetchTickets = React.useCallback(async () => {
    if (missingCompany) {
      setTickets([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    if (!selectedCompany?.id) return;

    try {
      const result = await getTicketsList(selectedCompany.id);
      if (result.success && result.data) {
        setTickets(result.data);
        setLoadError(null);
      } else if (!result.success) {
        const errorType = classifyClientError(null, undefined, result.errorType);
        setLoadError(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudieron cargar los tickets',
          ),
        );
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      const errorType = classifyClientError(error);
      setLoadError(
        getErrorMessageByType(errorType, 'No se pudieron cargar los tickets'),
      );
    } finally {
      setLoading(false);
    }
  }, [missingCompany, selectedCompany?.id]);

  React.useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleDelete = React.useCallback((id: number) => {
    setTickets((prevTickets) =>
      prevTickets.filter((ticket) => Number(ticket.id) !== id),
    );
  }, []);

  const columns = React.useMemo(
    () => createTicketsColumns({ onDelete: handleDelete, canWrite }),
    [handleDelete, canWrite],
  );

  const filteredTickets = React.useMemo(
    () =>
      filterTickets(tickets, {
        searchValue,
        statusFilter,
        pdfFilter,
        finishedFilter,
        dateRange,
      }),
    [tickets, searchValue, statusFilter, pdfFilter, finishedFilter, dateRange],
  );

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [searchValue, statusFilter, pdfFilter, finishedFilter, dateRange]);

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
    pdfFilter,
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
    setPdfFilter('all');
    setFinishedFilter('all');
    setDateRange(undefined);
    setSorting(DEFAULT_TICKET_SORTING);
  };

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
        pdfFilter={pdfFilter}
        onPdfFilterChange={setPdfFilter}
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

      {listState.kind === 'error' ? (
        <TripledEmptyState
          icon={<TicketIcon className="h-4 w-4" />}
          title="Error de carga"
          description={listState.message}
          role="alert"
          action={
            <Button variant="outline" onClick={fetchTickets}>
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
              />
            ))}
          </div>

          <TicketsListTable table={table} canWrite={canWrite} />
          <TicketsListPagination table={table} />
        </>
      )}
    </div>
  );
}
