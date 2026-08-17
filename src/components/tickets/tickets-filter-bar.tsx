import type { SortingState } from '@tanstack/react-table';
import type { DateRange } from 'react-day-picker';
import {
  TicketDateRangeFilter,
  TicketFinishedFilter,
  TicketStatusFilter,
} from '@/components/tickets/tickets-filter-fields';
import type {
  FinishedFilterValue,
  StatusFilterValue,
} from '@/components/tickets/tickets-list-types';
import { TicketsSortControls } from '@/components/tickets/tickets-sort-controls';
import {
  ListFilterBarShell,
  type ListFilterChip,
} from '@/components/list-filter';

type TicketsFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilterValue;
  onStatusFilterChange: (value: StatusFilterValue) => void;
  finishedFilter: FinishedFilterValue;
  onFinishedFilterChange: (value: FinishedFilterValue) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (value: DateRange | undefined) => void;
  sorting: SortingState;
  onSortingChange: (value: SortingState) => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filterChips: ListFilterChip[];
};

const renderTicketFilters = (
  statusFilter: StatusFilterValue,
  onStatusFilterChange: (value: StatusFilterValue) => void,
  finishedFilter: FinishedFilterValue,
  onFinishedFilterChange: (value: FinishedFilterValue) => void,
  dateRange: DateRange | undefined,
  onDateRangeChange: (value: DateRange | undefined) => void,
  layout: 'desktop' | 'sheet',
) => (
  <>
    <TicketStatusFilter
      layout={layout}
      value={statusFilter}
      onChange={onStatusFilterChange}
    />
    <TicketFinishedFilter
      layout={layout}
      value={finishedFilter}
      onChange={onFinishedFilterChange}
    />
    <TicketDateRangeFilter
      layout={layout}
      value={dateRange}
      onChange={onDateRangeChange}
    />
  </>
);

export const TicketsFilterBar = ({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  finishedFilter,
  onFinishedFilterChange,
  dateRange,
  onDateRangeChange,
  sorting,
  onSortingChange,
  activeFilterCount,
  hasActiveFilters,
  onClearFilters,
  filterChips,
}: TicketsFilterBarProps) => (
  <ListFilterBarShell
    searchValue={searchValue}
    onSearchChange={onSearchChange}
    searchPlaceholder="Buscar tickets..."
    searchAriaLabel="Buscar tickets por ID, cliente, teléfono o correo"
    searchContainerClassName="relative min-w-0 flex-1 lg:min-w-0"
    sheetFilterCount={activeFilterCount}
    sheetDescription="Estado de cobro, finalización, fechas y orden de la lista."
    hasActiveFilters={hasActiveFilters}
    onClearFilters={onClearFilters}
    clearFiltersAriaLabel="Limpiar filtros"
    filterChips={filterChips}
    sheetContent={
      <>
        {renderTicketFilters(
          statusFilter,
          onStatusFilterChange,
          finishedFilter,
          onFinishedFilterChange,
          dateRange,
          onDateRangeChange,
          'sheet',
        )}
        <TicketsSortControls
          sorting={sorting}
          onSortingChange={onSortingChange}
          id="ticket-sort-sheet"
          className="space-y-2"
        />
      </>
    }
    desktopContent={
      <div className="flex flex-wrap items-center gap-3">
        {renderTicketFilters(
          statusFilter,
          onStatusFilterChange,
          finishedFilter,
          onFinishedFilterChange,
          dateRange,
          onDateRangeChange,
          'desktop',
        )}
      </div>
    }
  />
);
