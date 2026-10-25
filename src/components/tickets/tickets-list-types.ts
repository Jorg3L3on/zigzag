import type { SortingState } from '@tanstack/react-table';
import type { DateRange } from 'react-day-picker';
import type { TicketPaymentStatus } from '@/lib/ticket-payment-status';

/** `due` = Por cobrar: parcial or sin pagos (ZIG-I13-7). */
export type StatusFilterValue = 'all' | TicketPaymentStatus | 'due';
export type FinishedFilterValue = 'all' | 'yes' | 'no';

export type TicketsFilterState = {
  searchValue: string;
  statusFilter: StatusFilterValue;
  finishedFilter: FinishedFilterValue;
  dateRange: DateRange | undefined;
  sorting: SortingState;
};

/** `?status=` of the tickets list; anything unknown means all (links in WhatsApp keep working). */
export const parseStatusFilter = (value: string | null): StatusFilterValue => {
  if (value === 'paid' || value === 'partial' || value === 'pending' || value === 'due') {
    return value;
  }
  return 'all';
};

export const parseFinishedFilter = (value: string | null): FinishedFilterValue => {
  if (value === 'yes' || value === 'no') {
    return value;
  }
  return 'all';
};

/** Desktop collections views. Each one is a single existing URL filter (ZIG-I28-4). */
export type TicketCollectionView = 'all' | 'due' | 'inProgress' | 'paid';

/**
 * The tab that matches the current URL. Mixed filters (the phone sheet can set both)
 * match no tab.
 */
export const ticketCollectionView = (
  status: StatusFilterValue,
  finished: FinishedFilterValue,
): TicketCollectionView | null => {
  if (status === 'due' && finished === 'all') return 'due';
  if (status === 'paid' && finished === 'all') return 'paid';
  if (finished === 'no' && status === 'all') return 'inProgress';
  if (status === 'all' && finished === 'all') return 'all';
  return null;
};

/** Por cobrar = status=due, Pagados = status=paid, En proceso = finished=no, Todos clears both. */
export const filtersForTicketCollectionView = (
  view: TicketCollectionView,
): { status: StatusFilterValue; finished: FinishedFilterValue } => {
  if (view === 'due') return { status: 'due', finished: 'all' };
  if (view === 'paid') return { status: 'paid', finished: 'all' };
  if (view === 'inProgress') return { status: 'all', finished: 'no' };
  return { status: 'all', finished: 'all' };
};
