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
