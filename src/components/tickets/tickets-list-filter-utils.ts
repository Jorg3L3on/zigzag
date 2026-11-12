import { matchesSearchText } from '@/lib/search-text';
import type { Ticket } from '@/actions/tickets';
import { endOfDay, format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_LABEL,
} from '@/lib/ticket-payment-status';
import type {
  FinishedFilterValue,
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
    return 'Todas las fechas';
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
    'searchValue' | 'statusFilter' | 'finishedFilter' | 'dateRange'
  >,
): Ticket[] => {
  const search = filters.searchValue.trim();
  return tickets.filter((ticket) => {
    const matchesSearch =
      ticket.id.toString().includes(search) ||
      matchesSearchText([ticket.client_name, ticket.client_tel, ticket.email], search);

    if (!matchesSearch) {
      return false;
    }

    if (filters.statusFilter !== 'all') {
      const paymentStatus = getTicketPaymentStatus(ticket.total, ticket.paid);
      if (filters.statusFilter === 'due') {
        if (!ticket.finished || getTicketBalanceDue(ticket.total, ticket.paid) <= 0) {
          return false;
        }
      } else if (paymentStatus !== filters.statusFilter) {
        return false;
      }
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
    'searchValue' | 'statusFilter' | 'finishedFilter' | 'dateRange' | 'clientId'
  >,
): number => {
  let n = 0;
  if (filters.clientId) {
    n += 1;
  }
  if (filters.searchValue.trim()) {
    n += 1;
  }
  if (filters.statusFilter !== 'all') {
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
    'searchValue' | 'statusFilter' | 'finishedFilter' | 'dateRange' | 'clientId'
  >,
): boolean => countActiveFilters(filters) > 0;

/** The chosen client's chip: its name and how to drop it (ZIG-I37-1). */
export type TicketClientChip = { name: string; onRemove: () => void };

export const buildTicketFilterChips = (
  totalCount: number,
  _filteredCount: number,
  filters: Pick<
    TicketsFilterState,
    'searchValue' | 'statusFilter' | 'finishedFilter' | 'dateRange' | 'clientId'
  >,
  client?: TicketClientChip | null,
): Array<{
  key: string;
  label: string;
  variant?: 'secondary';
  onRemove?: () => void;
  removeAriaLabel?: string;
}> => [
  {
    key: 'count',
    // «41 tickets» without a filter, «3 resultados» with one; never «1 de 1» (ZIG-I36 M-26).
    label: hasActiveTicketFilters(filters)
      ? `${totalCount} ${totalCount === 1 ? 'resultado' : 'resultados'}`
      : `${totalCount} ${totalCount === 1 ? 'ticket' : 'tickets'}`,
    variant: 'secondary' as const,
  },
  ...(filters.clientId && client
    ? [
        {
          key: 'client',
          label: `Cliente: ${client.name}`,
          onRemove: client.onRemove,
          removeAriaLabel: `Quitar filtro Cliente: ${client.name}`,
        },
      ]
    : []),
  ...(filters.statusFilter !== 'all'
    ? [
        {
          key: 'status',
          label:
            filters.statusFilter === 'due'
              ? 'Por cobrar'
              : TICKET_PAYMENT_STATUS_LABEL[filters.statusFilter],
        },
      ]
    : []),
  ...(filters.finishedFilter !== 'all'
    ? [
        {
          key: 'finished',
          label: filters.finishedFilter === 'yes' ? 'Terminados' : 'En proceso',
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
  setFinishedFilter: (value: FinishedFilterValue) => void;
  setDateRange: (value: DateRange | undefined) => void;
};
