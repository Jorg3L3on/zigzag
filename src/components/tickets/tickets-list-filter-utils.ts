import type { Ticket } from '@/actions/tickets';
import { endOfDay, format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import {
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_LABEL,
} from '@/lib/ticket-payment-status';
import type {
  FinishedFilterValue,
  PdfFilterValue,
  StatusFilterValue,
  TicketsFilterState,
} from '@/components/tickets/tickets-list-types';

export const ticketMatchesDateRange = (
  ticketDate: Date | null | undefined,
  range: DateRange | undefined,
): boolean => {
  if (!range?.from) {
    return true;
  }
  if (!ticketDate) {
    return false;
  }
  const start = startOfDay(range.from);
  const end = range.to ? endOfDay(range.to) : endOfDay(range.from);
  const t = ticketDate.getTime();
  return t >= start.getTime() && t <= end.getTime();
};

export const formatDateRangeLabel = (range: DateRange | undefined): string => {
  if (!range?.from) {
    return 'Rango de fechas';
  }
  if (!range.to) {
    return format(range.from, 'd MMM yyyy', { locale: es });
  }
  return `${format(range.from, 'd MMM yyyy', { locale: es })} — ${format(range.to, 'd MMM yyyy', { locale: es })}`;
};

export const filterTickets = (
  tickets: Ticket[],
  filters: Pick<
    TicketsFilterState,
    | 'searchValue'
    | 'statusFilter'
    | 'pdfFilter'
    | 'finishedFilter'
    | 'dateRange'
  >,
): Ticket[] => {
  const search = filters.searchValue.toLowerCase().trim();
  return tickets.filter((ticket) => {
    const matchesSearch =
      ticket.id.toString().includes(search) ||
      (ticket.client_name ?? '').toLowerCase().includes(search) ||
      (ticket.client_tel ?? '').toLowerCase().includes(search) ||
      (ticket.email ?? '').toLowerCase().includes(search);

    if (!matchesSearch) {
      return false;
    }

    if (filters.statusFilter !== 'all') {
      const paymentStatus = getTicketPaymentStatus(ticket.total, ticket.paid);
      if (paymentStatus !== filters.statusFilter) {
        return false;
      }
    }

    if (filters.pdfFilter === 'with' && !ticket.document) {
      return false;
    }
    if (filters.pdfFilter === 'without' && ticket.document) {
      return false;
    }

    if (filters.finishedFilter === 'yes' && !ticket.finished) {
      return false;
    }
    if (filters.finishedFilter === 'no' && ticket.finished) {
      return false;
    }

    if (!ticketMatchesDateRange(ticket.ticket_date, filters.dateRange)) {
      return false;
    }

    return true;
  });
};

export const countActiveFilters = (
  filters: Pick<
    TicketsFilterState,
    | 'searchValue'
    | 'statusFilter'
    | 'pdfFilter'
    | 'finishedFilter'
    | 'dateRange'
  >,
): number => {
  let n = 0;
  if (filters.searchValue.trim()) {
    n += 1;
  }
  if (filters.statusFilter !== 'all') {
    n += 1;
  }
  if (filters.pdfFilter !== 'all') {
    n += 1;
  }
  if (filters.finishedFilter !== 'all') {
    n += 1;
  }
  if (filters.dateRange?.from) {
    n += 1;
  }
  return n;
};

export const hasActiveTicketFilters = (
  filters: Pick<
    TicketsFilterState,
    | 'searchValue'
    | 'statusFilter'
    | 'pdfFilter'
    | 'finishedFilter'
    | 'dateRange'
  >,
): boolean => countActiveFilters(filters) > 0;

export const buildTicketFilterChips = (
  tickets: Ticket[],
  filteredCount: number,
  filters: Pick<
    TicketsFilterState,
    | 'searchValue'
    | 'statusFilter'
    | 'pdfFilter'
    | 'finishedFilter'
    | 'dateRange'
  >,
) => [
  {
    key: 'count',
    label: `${filteredCount} de ${tickets.length} tickets`,
    variant: 'secondary' as const,
  },
  ...(filters.statusFilter !== 'all'
    ? [
        {
          key: 'status',
          label: TICKET_PAYMENT_STATUS_LABEL[filters.statusFilter],
        },
      ]
    : []),
  ...(filters.finishedFilter !== 'all'
    ? [
        {
          key: 'finished',
          label: filters.finishedFilter === 'yes' ? 'Finalizados' : 'En proceso',
        },
      ]
    : []),
  ...(filters.pdfFilter !== 'all'
    ? [
        {
          key: 'pdf',
          label: filters.pdfFilter === 'with' ? 'Con PDF' : 'Sin PDF',
        },
      ]
    : []),
  ...(filters.dateRange?.from
    ? [
        {
          key: 'date',
          label: formatDateRangeLabel(filters.dateRange),
        },
      ]
    : []),
  ...(filters.searchValue.trim()
    ? [
        {
          key: 'search',
          label: `Búsqueda: ${filters.searchValue.trim()}`,
        },
      ]
    : []),
];

export type TicketFilterSetters = {
  setSearchValue: (value: string) => void;
  setStatusFilter: (value: StatusFilterValue) => void;
  setPdfFilter: (value: PdfFilterValue) => void;
  setFinishedFilter: (value: FinishedFilterValue) => void;
  setDateRange: (value: DateRange | undefined) => void;
};
