'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import type { Ticket } from '@/actions/tickets';
import { getTicketsList } from '@/actions/tickets';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FormattedDate } from '@/components/formatted-date';
import { FormattedCurrency } from '@/components/formatted-currency';
import { TicketPaymentBadge } from '@/components/tickets/ticket-payment-badge';
import { TicketRowActions } from '@/components/tickets/ticket-row-actions';
import { createTicketsColumns } from '@/components/tickets/tickets-columns';
import {
  DEFAULT_TICKET_SORTING,
  TICKETS_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/tickets/tickets-sort-presets';
import { useCompany } from '@/contexts/company-context';
import { Input } from '@/components/ui/input';
import { TripledEmptyState } from '@/components/tripled';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Search,
  Ticket as TicketIcon,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import {
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_LABEL,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import type { DateRange } from 'react-day-picker';
import { endOfDay, format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { hrefForTicketListRow } from '@/lib/ticket-list-navigation';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
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

type StatusFilterValue = 'all' | TicketPaymentStatus;
type PdfFilterValue = 'all' | 'with' | 'without';
type FinishedFilterValue = 'all' | 'yes' | 'no';

const ticketMatchesDateRange = (
  ticketDate: Date | null | undefined,
  range: DateRange | undefined,
): boolean => {
  if (!range?.from) {
    return true;
  }
  if (!ticketDate) {
    return false;
  }
  const day = ticketDate;
  const start = startOfDay(range.from);
  const end = range.to ? endOfDay(range.to) : endOfDay(range.from);
  const t = day.getTime();
  return t >= start.getTime() && t <= end.getTime();
};

const formatDateRangeLabel = (range: DateRange | undefined): string => {
  if (!range?.from) {
    return 'Rango de fechas';
  }
  if (!range.to) {
    return format(range.from, "d MMM yyyy", { locale: es });
  }
  return `${format(range.from, "d MMM yyyy", { locale: es })} — ${format(range.to, "d MMM yyyy", { locale: es })}`;
};

const TicketsTableSkeleton = () => (
  <div
    className="space-y-4"
    aria-busy="true"
    aria-live="polite"
    aria-label="Cargando tabla de tickets"
  >
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 lg:hidden">
        <Skeleton className="h-10 min-w-0 flex-1" />
        <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
      </div>
      <Skeleton className="hidden h-10 w-full lg:block" />
      <div className="hidden gap-3 lg:flex lg:flex-wrap lg:items-center">
        <Skeleton className="h-10 min-w-[12rem] max-w-[15rem]" />
        <Skeleton className="h-10 min-w-[9rem] max-w-[12rem]" />
        <Skeleton className="h-10 min-w-[11rem] max-w-[14rem]" />
        <Skeleton className="h-10 min-w-[14rem] max-w-[17rem]" />
      </div>
      <Skeleton className="h-4 w-56" />
    </div>
    <div className="hidden rounded-xl border border-border/70 shadow-sm md:block">
      <Table
        className={
          '[&_td]:py-2.5 [&_th]:h-10 [&_th]:py-2 [&_th]:align-middle [&_tr]:border-border/60'
        }
      >
        <TableHeader>
          <TableRow>
            {Array.from({ length: 7 }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-8 w-24" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, row) => (
            <TableRow key={row}>
              {Array.from({ length: 7 }).map((__, col) => (
                <TableCell key={col}>
                  <Skeleton className="h-5 w-full max-w-[8rem]" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    <div className="space-y-3 md:hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-md" />
      ))}
    </div>
  </div>
);

export default function TicketsList() {
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const canWriteTickets = permissions.can(PERMISSIONS.tickets.write);
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
  }, [selectedCompany?.id]);

  React.useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleDelete = React.useCallback((id: number) => {
    setTickets((prevTickets) =>
      prevTickets.filter((ticket) => Number(ticket.id) !== id),
    );
  }, []);

  const columns = React.useMemo(
    () => createTicketsColumns({ onDelete: handleDelete, canWrite: canWriteTickets }),
    [handleDelete, canWriteTickets],
  );

  const filteredTickets = React.useMemo(() => {
    const search = searchValue.toLowerCase().trim();
    return tickets.filter((ticket) => {
      const matchesSearch =
        ticket.id.toString().includes(search) ||
        (ticket.client_name ?? '').toLowerCase().includes(search) ||
        (ticket.client_tel ?? '').toLowerCase().includes(search) ||
        (ticket.email ?? '').toLowerCase().includes(search);

      if (!matchesSearch) {
        return false;
      }

      if (statusFilter !== 'all') {
        const paymentStatus = getTicketPaymentStatus(ticket.total, ticket.paid);
        if (paymentStatus !== statusFilter) {
          return false;
        }
      }

      if (pdfFilter === 'with' && !ticket.document) {
        return false;
      }
      if (pdfFilter === 'without' && ticket.document) {
        return false;
      }

      if (finishedFilter === 'yes' && !ticket.finished) {
        return false;
      }
      if (finishedFilter === 'no' && ticket.finished) {
        return false;
      }

      if (!ticketMatchesDateRange(ticket.ticket_date, dateRange)) {
        return false;
      }

      return true;
    });
  }, [
    tickets,
    searchValue,
    statusFilter,
    pdfFilter,
    finishedFilter,
    dateRange,
  ]);

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [
    searchValue,
    statusFilter,
    pdfFilter,
    finishedFilter,
    dateRange,
  ]);

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

  const hasActiveFilters =
    searchValue.trim() !== '' ||
    statusFilter !== 'all' ||
    pdfFilter !== 'all' ||
    finishedFilter !== 'all' ||
    Boolean(dateRange?.from);

  const activeFilterCount = React.useMemo(() => {
    let n = 0;
    if (searchValue.trim()) {
      n += 1;
    }
    if (statusFilter !== 'all') {
      n += 1;
    }
    if (pdfFilter !== 'all') {
      n += 1;
    }
    if (finishedFilter !== 'all') {
      n += 1;
    }
    if (dateRange?.from) {
      n += 1;
    }
    return n;
  }, [searchValue, statusFilter, pdfFilter, finishedFilter, dateRange]);

  const handleClearFilters = () => {
    setSearchValue('');
    setStatusFilter('all');
    setPdfFilter('all');
    setFinishedFilter('all');
    setDateRange(undefined);
    setSorting(DEFAULT_TICKET_SORTING);
  };

  const mobileSortValue = encodeSortingState(sorting);

  if (loading) {
    return <TicketsTableSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 w-full gap-2">
            <div className="relative min-w-0 flex-1 lg:min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 pl-9"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Buscar por ID, cliente, teléfono o correo..."
                aria-label="Buscar tickets por ID, cliente, teléfono o correo"
              />
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="relative shrink-0 lg:hidden"
                  aria-label={
                    activeFilterCount > 0
                      ? `Abrir filtros (${activeFilterCount} activos)`
                      : 'Abrir filtros'
                  }
                >
                  <ListFilter className="h-4 w-4" aria-hidden />
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
                    Estado de cobro, PDF, finalización, fechas y orden de la
                    lista.
                  </SheetDescription>
                </SheetHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="ticket-filter-status-sheet"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Estado de cobro
                    </label>
                    <Select
                      value={statusFilter}
                      onValueChange={(value) =>
                        setStatusFilter(value as StatusFilterValue)
                      }
                    >
                      <SelectTrigger
                        id="ticket-filter-status-sheet"
                        className="h-11 w-full"
                        aria-label="Filtrar por estado de cobro"
                      >
                        <SelectValue placeholder="Estado de cobro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          Todos los estados de cobro
                        </SelectItem>
                        <SelectItem value="paid">
                          {TICKET_PAYMENT_STATUS_LABEL.paid}
                        </SelectItem>
                        <SelectItem value="partial">
                          {TICKET_PAYMENT_STATUS_LABEL.partial}
                        </SelectItem>
                        <SelectItem value="pending">
                          {TICKET_PAYMENT_STATUS_LABEL.pending}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="ticket-filter-pdf-sheet"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      PDF
                    </label>
                    <Select
                      value={pdfFilter}
                      onValueChange={(value) =>
                        setPdfFilter(value as PdfFilterValue)
                      }
                    >
                      <SelectTrigger
                        id="ticket-filter-pdf-sheet"
                        className="h-11 w-full"
                        aria-label="Filtrar por PDF"
                      >
                        <SelectValue placeholder="PDF" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">PDF (todos)</SelectItem>
                        <SelectItem value="with">Con PDF</SelectItem>
                        <SelectItem value="without">Sin PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="ticket-filter-finished-sheet"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Finalización
                    </label>
                    <Select
                      value={finishedFilter}
                      onValueChange={(value) =>
                        setFinishedFilter(value as FinishedFilterValue)
                      }
                    >
                      <SelectTrigger
                        id="ticket-filter-finished-sheet"
                        className="h-11 w-full"
                        aria-label="Filtrar por ticket finalizado"
                      >
                        <SelectValue placeholder="Finalización" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          Finalización (todas)
                        </SelectItem>
                        <SelectItem value="yes">Finalizado</SelectItem>
                        <SelectItem value="no">En proceso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Rango de fechas
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            'h-11 w-full justify-start text-left font-normal',
                            !dateRange?.from && 'text-muted-foreground',
                          )}
                          aria-label="Filtrar por rango de fechas del ticket"
                        >
                          <CalendarDays className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                          <span className="truncate">
                            {formatDateRangeLabel(dateRange)}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center">
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={1}
                          initialFocus
                        />
                        <div className="border-t p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            className="min-h-11 w-full"
                            onClick={() => setDateRange(undefined)}
                            aria-label="Limpiar rango de fechas"
                          >
                            Limpiar fechas
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="ticket-sort-sheet"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Ordenar por
                    </label>
                    <Select
                      value={mobileSortValue}
                      onValueChange={(value) =>
                        setSorting(decodeSortingState(value))
                      }
                    >
                      <SelectTrigger
                        id="ticket-sort-sheet"
                        className="h-11 w-full"
                        aria-label="Ordenar lista de tickets"
                      >
                        <SelectValue placeholder="Ordenar por" />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKETS_MOBILE_SORT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={handleClearFilters}
                      aria-label="Limpiar todos los filtros activos"
                    >
                      <X className="mr-2 h-4 w-4 shrink-0" aria-hidden />
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
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as StatusFilterValue)
              }
            >
              <SelectTrigger
                className="h-10 min-w-[12rem] max-w-[15rem] shrink-0"
                aria-label="Filtrar por estado de cobro"
              >
                <SelectValue placeholder="Estado de cobro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados de cobro</SelectItem>
                <SelectItem value="paid">
                  {TICKET_PAYMENT_STATUS_LABEL.paid}
                </SelectItem>
                <SelectItem value="partial">
                  {TICKET_PAYMENT_STATUS_LABEL.partial}
                </SelectItem>
                <SelectItem value="pending">
                  {TICKET_PAYMENT_STATUS_LABEL.pending}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={pdfFilter}
              onValueChange={(value) => setPdfFilter(value as PdfFilterValue)}
            >
              <SelectTrigger
                className="h-10 min-w-[9rem] max-w-[12rem] shrink-0"
                aria-label="Filtrar por PDF"
              >
                <SelectValue placeholder="PDF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">PDF (todos)</SelectItem>
                <SelectItem value="with">Con PDF</SelectItem>
                <SelectItem value="without">Sin PDF</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={finishedFilter}
              onValueChange={(value) =>
                setFinishedFilter(value as FinishedFilterValue)
              }
            >
              <SelectTrigger
                className="h-10 min-w-[11rem] max-w-[14rem] shrink-0"
                aria-label="Filtrar por ticket finalizado"
              >
                <SelectValue placeholder="Finalización" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Finalización (todas)</SelectItem>
                <SelectItem value="yes">Finalizado</SelectItem>
                <SelectItem value="no">En proceso</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'h-10 min-w-[14rem] max-w-[17rem] shrink-0 justify-start text-left font-normal',
                    !dateRange?.from && 'text-muted-foreground',
                  )}
                  aria-label="Filtrar por rango de fechas del ticket"
                >
                  <CalendarDays className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate">
                    {formatDateRangeLabel(dateRange)}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  initialFocus
                />
                <div className="border-t p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setDateRange(undefined)}
                  >
                    Limpiar fechas
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                className="shrink-0"
                onClick={handleClearFilters}
              >
                <X className="mr-2 h-4 w-4" />
                Limpiar filtros
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground sm:text-sm">
            Mostrando{' '}
            <span className="font-medium text-foreground">
              {filteredTickets.length}
            </span>{' '}
            de{' '}
            <span className="font-medium text-foreground">{tickets.length}</span>{' '}
            tickets
            {table.getPageCount() > 1 ? (
              <>
                {' '}
                · Página{' '}
                <span className="font-medium text-foreground">
                  {table.getState().pagination.pageIndex + 1}
                </span>{' '}
                de{' '}
                <span className="font-medium text-foreground">
                  {table.getPageCount()}
                </span>
              </>
            ) : null}
          </p>
        </div>

      {loadError ? (
        <div className="space-y-4">
          <TripledEmptyState
            icon={<TicketIcon className="h-4 w-4" />}
            title="Error de carga"
            description={loadError}
          />
          <div className="flex justify-center">
            <Button variant="outline" onClick={fetchTickets}>
              Reintentar
            </Button>
          </div>
        </div>
      ) : filteredTickets.length === 0 ? (
        <TripledEmptyState
          icon={<TicketIcon className="h-4 w-4" />}
          title="Sin tickets"
          description={
            tickets.length === 0
              ? 'No hay tickets registrados aún.'
              : 'No hay tickets que coincidan con los filtros seleccionados.'
          }
        />
      ) : (
        <>
          <div className="space-y-2.5 md:hidden">
            {table.getRowModel().rows.map((row) => {
              const ticket = row.original;
              return (
                <div
                  key={row.id}
                  className="cursor-pointer rounded-xl border border-border/70 bg-card p-3.5 shadow-sm transition-colors hover:bg-muted/40 active:bg-muted/60"
                  tabIndex={0}
                  role="button"
                  aria-label={
                    ticket.finished
                      ? `Ver ticket ${ticket.id.toString()}`
                      : canWriteTickets
                        ? `Editar ticket ${ticket.id.toString()}`
                        : `Ver ticket ${ticket.id.toString()}`
                  }
                  onClick={() =>
                    router.push(hrefForTicketListRow(ticket, canWriteTickets))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      router.push(hrefForTicketListRow(ticket, canWriteTickets));
                    }
                  }}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-2">
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Ticket
                        </p>
                        <p className="font-mono text-base font-semibold tabular-nums">
                          #{ticket.id.toString()}
                        </p>
                      </div>
                      <TicketPaymentBadge
                        total={ticket.total}
                        paid={ticket.paid}
                      />
                    </div>
                    <div onClick={(event) => event.stopPropagation()}>
                      <TicketRowActions
                        ticket={ticket}
                        onDelete={handleDelete}
                        canWrite={canWriteTickets}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Cliente
                      </p>
                      <p className="truncate font-medium leading-snug">
                        {ticket.client_name || '—'}
                      </p>
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Teléfono
                      </p>
                      <p className="tabular-nums leading-snug">
                        {ticket.client_tel || '—'}
                      </p>
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Fecha
                      </p>
                      <p className="leading-snug">
                        <FormattedDate date={ticket.ticket_date} />
                      </p>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Total
                      </p>
                      <p className="font-semibold tabular-nums">
                        <FormattedCurrency amount={ticket.total} />
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border/70 shadow-sm md:block">
            <Table
              className={
                '[&_td]:py-2.5 [&_th]:h-10 [&_th]:py-2 [&_th]:align-middle [&_tr]:border-border/60'
              }
            >
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
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() =>
                      router.push(hrefForTicketListRow(row.original, canWriteTickets))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(
                          hrefForTicketListRow(row.original, canWriteTickets),
                        );
                      }
                    }}
                  >
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

          <div className="flex flex-col items-stretch justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 px-3 py-4 sm:flex-row sm:items-center sm:px-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="whitespace-nowrap">Filas por página</span>
              <Select
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="h-9 w-[4.5rem]" aria-label="Filas por página">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[8rem] text-center text-sm tabular-nums text-muted-foreground">
                {table.getState().pagination.pageIndex + 1} /{' '}
                {table.getPageCount()}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
