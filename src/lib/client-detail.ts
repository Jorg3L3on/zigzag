/**
 * Client detail helpers (ZIG-I17-2): the balance of a client is the sum of the
 * unpaid amounts on its finished work tickets, the same rule cobranza uses.
 */

import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { isWorkTicket } from '@/lib/ticket-document-kind';

export type ClientBalanceTicketInput = {
  document_kind?: string | null;
  finished: boolean;
  total: number | null;
  paid: number | null;
};

export type ClientBalanceSummary = {
  /** Sum of unpaid amounts on finished work tickets. */
  balanceDue: number;
  /** Finished work tickets that still owe something. */
  dueTicketCount: number;
  /** Work tickets, finished or not. */
  ticketCount: number;
};

const roundCents = (value: number): number => Math.round(value * 100) / 100;

export const summarizeClientBalance = (
  tickets: ClientBalanceTicketInput[],
): ClientBalanceSummary => {
  let balanceDue = 0;
  let dueTicketCount = 0;
  let ticketCount = 0;

  for (const row of tickets) {
    if (!isWorkTicket(row.document_kind)) continue;
    ticketCount += 1;
    if (!row.finished) continue;
    const due = getTicketBalanceDue(row.total, row.paid);
    if (due <= 0 || getTicketPaymentStatus(row.total, row.paid) === 'paid') {
      continue;
    }
    balanceDue += due;
    dueTicketCount += 1;
  }

  return { balanceDue: roundCents(balanceDue), dueTicketCount, ticketCount };
};

export const CLIENT_NOTES_MAX_LENGTH = 2000;

/** Empty or whitespace-only notes are stored as null. */
export const normalizeClientNotes = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
};
