import type { SortingState } from '@tanstack/react-table';
import { ListFilter, Search, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  TicketDateRangeFilter,
  TicketFinishedFilter,
  TicketPdfFilter,
  TicketStatusFilter,
} from '@/components/tickets/tickets-filter-fields';
import type {
  FinishedFilterValue,
  PdfFilterValue,
  StatusFilterValue,
} from '@/components/tickets/tickets-list-types';
import { TicketsSortControls } from '@/components/tickets/tickets-sort-controls';
import { TripledFilterChips } from '@/components/tripled';

type TicketsFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilterValue;
  onStatusFilterChange: (value: StatusFilterValue) => void;
  pdfFilter: PdfFilterValue;
  onPdfFilterChange: (value: PdfFilterValue) => void;
  finishedFilter: FinishedFilterValue;
  onFinishedFilterChange: (value: FinishedFilterValue) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (value: DateRange | undefined) => void;
  sorting: SortingState;
  onSortingChange: (value: SortingState) => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filterChips: Array<{
    key: string;
    label: string;
    variant?: 'secondary';
  }>;
};

export const TicketsFilterBar = ({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  pdfFilter,
  onPdfFilterChange,
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
    <div className="flex min-w-0 w-full gap-2">
      <div className="relative min-w-0 flex-1 lg:min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-12 rounded-xl bg-muted/30 pl-9 shadow-none sm:h-11 sm:bg-background"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar tickets..."
          aria-label="Buscar tickets por ID, cliente, teléfono o correo"
        />
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="relative h-12 w-12 shrink-0 rounded-xl bg-background shadow-none lg:hidden"
            aria-label={
              activeFilterCount > 0
                ? `Abrir filtros (${activeFilterCount} activos)`
                : 'Abrir filtros'
            }
          >
            <ListFilter className="h-4 w-4" aria-hidden data-icon="inline-start"/>
            {activeFilterCount > 0 ? (
              <Badge
                variant="secondary"
                className="absolute -right-1 -top-1 flex h-5 min-w-5 justify-center px-1 text-[10px] leading-none"
              >
                {activeFilterCount > 9 ? '9+' : activeFilterCount}
              </Badge>
            ) : null}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex max-h-[min(90vh,680px)] flex-col rounded-t-2xl border-t p-0"
        >
          <div
            className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-muted"
            aria-hidden
          />
          <SheetHeader className="space-y-1 px-4 pb-3 pt-2 text-left">
            <SheetTitle
              data-initial-focus
              tabIndex={-1}
              className="outline-none focus:outline-none"
            >
              Filtros
            </SheetTitle>
            <SheetDescription>
              Estado de cobro, PDF, finalización, fechas y orden de la lista.
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
            <TicketStatusFilter
              layout="sheet"
              value={statusFilter}
              onChange={onStatusFilterChange}
            />
            <TicketPdfFilter
              layout="sheet"
              value={pdfFilter}
              onChange={onPdfFilterChange}
            />
            <TicketFinishedFilter
              layout="sheet"
              value={finishedFilter}
              onChange={onFinishedFilterChange}
            />
            <TicketDateRangeFilter
              layout="sheet"
              value={dateRange}
              onChange={onDateRangeChange}
            />
            <TicketsSortControls
              sorting={sorting}
              onSortingChange={onSortingChange}
              id="ticket-sort-sheet"
              className="space-y-2"
            />
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onClearFilters}
                aria-label="Limpiar todos los filtros activos"
              >
                <X className="mr-2 h-4 w-4 shrink-0" aria-hidden  data-icon="inline-start" />
                Limpiar todos los filtros
              </Button>
            ) : null}
          </div>

          <SheetFooter className="border-t bg-muted/30 px-4 py-3">
            <SheetClose asChild>
              <Button type="button" size="lg" className="min-h-11 w-full">
                Listo
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>

    <div className="hidden lg:flex lg:flex-wrap lg:items-center lg:gap-3">
      <TicketStatusFilter
        layout="desktop"
        value={statusFilter}
        onChange={onStatusFilterChange}
      />
      <TicketPdfFilter
        layout="desktop"
        value={pdfFilter}
        onChange={onPdfFilterChange}
      />
      <TicketFinishedFilter
        layout="desktop"
        value={finishedFilter}
        onChange={onFinishedFilterChange}
      />
      <TicketDateRangeFilter
        layout="desktop"
        value={dateRange}
        onChange={onDateRangeChange}
      />
      {hasActiveFilters ? (
        <Button
          type="button"
          variant="ghost"
          className="shrink-0"
          onClick={onClearFilters}
        >
          <X className="mr-2 h-4 w-4"  data-icon="inline-start" />
          Limpiar filtros
        </Button>
      ) : null}
    </div>

    <TripledFilterChips chips={filterChips} />
  </div>
);
