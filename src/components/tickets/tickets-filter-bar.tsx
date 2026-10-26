import type { SortingState } from '@tanstack/react-table';
import { ListFilter, Search } from 'lucide-react';
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
import { ListViewTabs } from '@/components/list-views/list-view-tabs';
import { TicketsSortControls } from '@/components/tickets/tickets-sort-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  FILTER_SELECTED_CLASS,
  ListFilterBarShell,
  type ListFilterChip,
} from '@/components/list-filter';

type TicketsFilterBarProps = {
  /** Tickets with a saldo under the search/date/finished filters (Por cobrar chip). */
  dueCount?: number | null;
  /** Tab counts under the current search and date range. */
  counts?: TicketListCounts | null;
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
}> = [
  { id: 'all', label: 'Todos', countKey: 'all' },
  { id: 'due', label: 'Por cobrar', countKey: 'due' },
  { id: 'inProgress', label: 'En proceso', countKey: 'inProgress' },
  { id: 'paid', label: 'Pagados', countKey: 'paid' },
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

const TicketCollectionTabs = ({
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
      tabs={COLLECTION_VIEWS.map((view) => ({
        id: view.id,
        label: view.label,
        count: counts ? counts[view.countKey] : null,
      }))}
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

export const TicketsFilterBar = ({
  dueCount = null,
  counts = null,
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
  <div className="flex flex-col gap-3">
    <div className="hidden flex-col gap-3 md:flex">
      <TicketCollectionTabs
        statusFilter={statusFilter}
        finishedFilter={finishedFilter}
        counts={counts}
        onStatusFilterChange={onStatusFilterChange}
        onFinishedFilterChange={onFinishedFilterChange}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative w-full max-w-[360px] shrink-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="h-11 rounded-xl bg-background pl-9 shadow-none"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por cliente, folio o teléfono"
            aria-label="Buscar por cliente, folio o teléfono"
          />
        </div>
        <TicketDateRangeFilter
          layout="desktop"
          value={dateRange}
          onChange={onDateRangeChange}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-11 shrink-0 gap-2 rounded-full px-4">
              <ListFilter className="h-4 w-4" aria-hidden data-icon="inline-start" />
              Más filtros
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <TicketsSortControls
              variant="full"
              sorting={sorting}
              onSortingChange={onSortingChange}
              id="ticket-sort-desktop"
              className="space-y-2"
            />
          </PopoverContent>
        </Popover>
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            onClick={onClearFilters}
            aria-label="Limpiar filtros"
          >
            Limpiar filtros
          </Button>
        ) : null}
      </div>
    </div>

    <div className="md:hidden">
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
    </div>
  </div>
);
