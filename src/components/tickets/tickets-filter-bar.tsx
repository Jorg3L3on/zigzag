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
import { MoneyFigure } from '@/components/documents/money-figure';
import { cn } from '@/lib/utils';
import {
  ListFilterBarShell,
  type ListFilterChip,
} from '@/components/list-filter';

type TicketsFilterBarProps = {
  /** Tickets with a saldo under the search/date/finished filters (Por cobrar chip). */
  dueCount?: number | null;
  /** Σ saldo of the tickets matching the filters, shown as "Por cobrar". */
  balanceDue?: number | null;
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

const QUICK_FILTERS: Array<{ value: StatusFilterValue; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'due', label: 'Por cobrar' },
  { value: 'paid', label: 'Pagados' },
];

/** Todos / Por cobrar / Pagados over the existing payment status filter (ZIG-I13-7). */
const TicketQuickFilters = ({
  value,
  onChange,
  dueCount,
}: {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
  dueCount: number | null;
}) => (
  <div role="group" aria-label="Filtro de cobro" className="flex flex-wrap gap-2">
    {QUICK_FILTERS.map((option) => {
      const pressed = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={pressed}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-11 rounded-full border px-4 text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            pressed
              ? 'border-foreground bg-foreground font-semibold text-background'
              : 'border-border text-muted-foreground hover:bg-muted/50',
          )}
        >
          {option.label}
          {option.value === 'due' && dueCount != null && dueCount > 0 ? ` · ${dueCount}` : ''}
        </button>
      );
    })}
  </div>
);

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
  dueCount = null,
  balanceDue = null,
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
    searchPlaceholder="Cliente, número de ticket o teléfono"
    searchAriaLabel="Buscar tickets por ID, cliente, teléfono o correo"
    searchContainerClassName="relative min-w-0 flex-1 lg:min-w-0"
    quickFilters={
      <TicketQuickFilters
        value={statusFilter}
        onChange={onStatusFilterChange}
        dueCount={dueCount}
      />
    }
    chipsTrailing={
      balanceDue == null ? undefined : (
        <p
          className="flex shrink-0 items-baseline gap-1.5 pt-1 text-caption text-muted-foreground"
          data-testid="tickets-balance-due"
        >
          <span>Por cobrar</span>
          <MoneyFigure amount={balanceDue} size="md" className="text-[15px] text-foreground" />
        </p>
      )
    }
    moreFiltersLabel="Más filtros"
    mobileSort={
      <TicketsSortControls
        variant="phone"
        sorting={sorting}
        onSortingChange={onSortingChange}
        id="ticket-sort-phone"
        className="min-w-0 flex-1 space-y-1"
        triggerClassName="h-12 w-full rounded-xl text-base"
      />
    }
    sheetFilterCount={activeFilterCount}
    sheetDescription="Cobro, terminado, fechas y orden de la lista."
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
