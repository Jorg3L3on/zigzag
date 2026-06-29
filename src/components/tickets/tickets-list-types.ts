import type { SortingState } from '@tanstack/react-table';
import type { DateRange } from 'react-day-picker';
import type { TicketPaymentStatus } from '@/lib/ticket-payment-status';

export type StatusFilterValue = 'all' | TicketPaymentStatus;
export type PdfFilterValue = 'all' | 'with' | 'without';
export type FinishedFilterValue = 'all' | 'yes' | 'no';

export type TicketsFilterState = {
  searchValue: string;
  statusFilter: StatusFilterValue;
  pdfFilter: PdfFilterValue;
  finishedFilter: FinishedFilterValue;
  dateRange: DateRange | undefined;
  sorting: SortingState;
};
