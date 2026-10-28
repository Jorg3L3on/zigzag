import type { ReactNode } from 'react';
import type { SortingState } from '@tanstack/react-table';
import type { DateRange } from 'react-day-picker';
import {
  TicketDateRangeFilter,
  TicketFinishedFilter,
} from '@/components/tickets/tickets-filter-fields';
import type { TicketListCounts } from '@/actions/tickets';
import type {
  FinishedFilterValue,
  StatusFilterValue,
  TicketCollectionView,
} from '@/components/tickets/tickets-list-types';
import {
  filtersForTicketCollectionView,
  ticketCollectionView,
} from '@/components/tickets/tickets-list-types';
import { TicketsSortControls } from '@/components/tickets/tickets-sort-controls';
import { cn } from '@/lib/utils';
import {
  FILTER_SELECTED_CLASS,
  ListFilterBarShell,
  ListFilterSelect,
  ListToolbar,
  ListViewTabs,
  type ListFilterChip,
} from '@/components/list-page';

type TicketsFilterBarProps = {
  /** Tickets with a saldo under the search/date/finished filters (Por cobrar chip). */
  dueCount?: number | null;
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

const COLLECTION_VIEWS: Array<{
  id: TicketCollectionView;
  label: string;
  countKey: keyof TicketListCounts;
  /** The canvas dot; the estado pill tones of the rows in that view (ZIG-I33 §6). */
  dot: string | null;
}> = [
  { id: 'all', label: 'Todos', countKey: 'all', dot: null },
  { id: 'due', label: 'Por cobrar', countKey: 'due', dot: 'bg-amber-500' },
  { id: 'inProgress', label: 'En proceso', countKey: 'inProgress', dot: 'bg-slate-500' },
  { id: 'paid', label: 'Pagados', countKey: 'paid', dot: 'bg-emerald-500' },
];

/**
 * Todos / Por cobrar / Pagados over the existing payment status filter (ZIG-I13-7). The
 * chosen chip is a state, tinted, never the solid blue of the page action (ZIG-I27-3).
 */
const TicketQuickFilters = ({
  value,
  onChange,
  dueCount,
}: {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
  dueCount: number | null;
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="hidden text-caption font-medium text-muted-foreground lg:block" aria-hidden>
      Cobro
    </span>
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
                ? FILTER_SELECTED_CLASS
                : 'border-border text-muted-foreground hover:bg-muted/50',
            )}
          >
            {option.label}
            {option.value === 'due' && dueCount != null && dueCount > 0 ? ` · ${dueCount}` : ''}
          </button>
        );
      })}
    </div>
  </div>
);

/** Todos / Por cobrar / En proceso / Pagados over the list, with counts (desktop). */
export const TicketCollectionTabs = ({
  statusFilter,
  finishedFilter,
  counts,
  onStatusFilterChange,
  onFinishedFilterChange,
}: {
  statusFilter: StatusFilterValue;
  finishedFilter: FinishedFilterValue;
  counts: TicketListCounts | null;
  onStatusFilterChange: (value: StatusFilterValue) => void;
  onFinishedFilterChange: (value: FinishedFilterValue) => void;
}) => {
  const active = ticketCollectionView(statusFilter, finishedFilter);

  const handleSelect = (view: TicketCollectionView) => {
    const next = filtersForTicketCollectionView(view);
    onStatusFilterChange(next.status);
    onFinishedFilterChange(next.finished);
  };

  return (
    <ListViewTabs
      label="Vistas de tickets"
      tabs={COLLECTION_VIEWS.map((view) => {
        const count = counts ? counts[view.countKey] : null;
        return {
          id: view.id,
          label: view.label,
          count,
          dot: view.dot,
          caption: count == null ? null : `${count} ${count === 1 ? 'ticket' : 'tickets'}`,
        };
      })}
      isSelected={(id) => active === id}
      onSelect={handleSelect}
    />
  );
};

const renderTicketFilters = (
  finishedFilter: FinishedFilterValue,
  onFinishedFilterChange: (value: FinishedFilterValue) => void,
  dateRange: DateRange | undefined,
  onDateRangeChange: (value: DateRange | undefined) => void,
  layout: 'desktop' | 'sheet',
) => (
  <>
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

/**
 * The phone filter bar (unchanged by ZIG-I33): search, the Cobro chips, the short
 * sort and Más filtros with the full sheet. Desktop uses `TicketsDesktopToolbar`.
 */
export const TicketsFilterBar = ({
  dueCount = null,
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
    searchAriaLabel="Buscar tickets por folio, cliente, teléfono o correo"
    searchContainerClassName="relative min-w-0 flex-1 lg:min-w-0"
    quickFilters={
      <TicketQuickFilters
        value={statusFilter}
        onChange={onStatusFilterChange}
        dueCount={dueCount}
      />
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
    showDesktopClear={false}
    sheetContent={
      <>
        {renderTicketFilters(
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
    desktopContent={null}
  />
);

const FINISHED_OPTIONS: ReadonlyArray<{ value: FinishedFilterValue; label: string }> = [
  { value: 'all', label: 'Todos los trabajos' },
  { value: 'yes', label: 'Terminados' },
  { value: 'no', label: 'En proceso' },
];

type TicketsDesktopToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  finishedFilter: FinishedFilterValue;
  onFinishedFilterChange: (value: FinishedFilterValue) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (value: DateRange | undefined) => void;
  hasActiveFilters: boolean;
  /** Clears the filters and the search, never the order. */
  onClearFilters: () => void;
  /** «Columnas», built by the list from its table. */
  columnsMenu?: ReactNode;
};

/**
 * The desktop filter row (ZIG-I33-2): search, the dates and Terminado as pills,
 * Limpiar filtros while one is on, Columnas at the right. No sort select: the
 * column headers sort.
 */
export const TicketsDesktopToolbar = ({
  searchValue,
  onSearchChange,
  finishedFilter,
  onFinishedFilterChange,
  dateRange,
  onDateRangeChange,
  hasActiveFilters,
  onClearFilters,
  columnsMenu = null,
}: TicketsDesktopToolbarProps) => (
  <ListToolbar
    search={{
      value: searchValue,
      onChange: onSearchChange,
      placeholder: 'Buscar por cliente, folio o teléfono',
      ariaLabel: 'Buscar por cliente, folio o teléfono',
    }}
    filters={
      <>
        <TicketDateRangeFilter layout="desktop" value={dateRange} onChange={onDateRangeChange} />
        <ListFilterSelect
          value={finishedFilter}
          allValue="all"
          onChange={onFinishedFilterChange}
          options={FINISHED_OPTIONS}
          ariaLabel="Filtrar por trabajo terminado"
        />
      </>
    }
    hasActiveFilters={hasActiveFilters}
    onClear={onClearFilters}
    trailing={columnsMenu}
  />
);
