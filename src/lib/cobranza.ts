/**
 * Cobranza queue helpers — aging, urgency sort, and client-side filters.
 * Saldo/status always come from ticket-payment-status helpers.
 */

import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { isWorkTicket } from '@/lib/ticket-document-kind';

export type CobranzaAgingBucket = 'all' | '0-14' | '15-30' | '30+';

export type CobranzaStatusFilter = 'all' | 'pending' | 'partial';

export type CobranzaTicketInput = {
  id: bigint | string | number;
  client_name: string | null;
  client_tel: string | null;
  ticket_date: Date | string | null;
  created_at: Date | string;
  total: number | null;
  paid: number | null;
  finished: boolean;
  company_id: number | null;
  document_kind?: string | null;
  /** Latest payment on record; days without payment count from here. */
  last_payment_at?: Date | string | null;
  /** "Compresor, Mano de obra": the work, for the card (ZIG-I18-2). */
  services_summary?: string | null;
};

export type CobranzaRow = {
  id: string;
  client_name: string | null;
  client_tel: string | null;
  ticket_date: Date | null;
  created_at: Date;
  total: number | null;
  paid: number | null;
  finished: boolean;
  company_id: number | null;
  balanceDue: number;
  paymentStatus: TicketPaymentStatus;
  /** Days without payment: since the last payment, else since the work date. */
  daysOutstanding: number;
  agingBucket: Exclude<CobranzaAgingBucket, 'all'>;
  last_payment_at: Date | null;
  services_summary: string | null;
};

export type CobranzaSort = 'days' | 'balance' | 'recent';

export const COBRANZA_SORT_OPTIONS: Array<{ value: CobranzaSort; label: string }> = [
  { value: 'days', label: 'Días sin pagar' },
  { value: 'balance', label: 'Mayor saldo' },
  { value: 'recent', label: 'Más recientes' },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Start of local calendar day for stable day counts in tests/UI. */
export const startOfLocalDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const toDateOrNull = (value: Date | string | null | undefined): Date | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Reference date for aging: ticket_date, else created_at. */
export const getCobranzaReferenceDate = (
  ticketDate: Date | string | null | undefined,
  createdAt: Date | string,
): Date => {
  return toDateOrNull(ticketDate) ?? toDateOrNull(createdAt) ?? new Date(0);
};

export const getDaysOutstanding = (
  referenceDate: Date,
  now: Date = new Date(),
): number => {
  const startRef = startOfLocalDay(referenceDate).getTime();
  const startNow = startOfLocalDay(now).getTime();
  const diff = Math.floor((startNow - startRef) / MS_PER_DAY);
  return Math.max(0, diff);
};

export const getAgingBucket = (
  daysOutstanding: number,
): Exclude<CobranzaAgingBucket, 'all'> => {
  if (daysOutstanding <= 14) return '0-14';
  if (daysOutstanding <= 30) return '15-30';
  return '30+';
};

export const isCobranzaAgingBucket = (
  value: string | null | undefined,
): value is CobranzaAgingBucket =>
  value === 'all' ||
  value === '0-14' ||
  value === '15-30' ||
  value === '30+';

export const isCobranzaStatusFilter = (
  value: string | null | undefined,
): value is CobranzaStatusFilter =>
  value === 'all' || value === 'pending' || value === 'partial';

export const toCobranzaRow = (
  ticket: CobranzaTicketInput,
  now: Date = new Date(),
): CobranzaRow | null => {
  if (!isWorkTicket(ticket.document_kind)) {
    return null;
  }

  const balanceDue = getTicketBalanceDue(ticket.total, ticket.paid);
  if (balanceDue <= 0) {
    return null;
  }

  const paymentStatus = getTicketPaymentStatus(ticket.total, ticket.paid);
  if (paymentStatus === 'paid') {
    return null;
  }

  const createdAt = toDateOrNull(ticket.created_at) ?? new Date(0);
  const ticketDate = toDateOrNull(ticket.ticket_date);
  const lastPaymentAt = toDateOrNull(ticket.last_payment_at);
  const referenceDate =
    lastPaymentAt ?? getCobranzaReferenceDate(ticketDate, createdAt);
  const daysOutstanding = getDaysOutstanding(referenceDate, now);
  const agingBucket = getAgingBucket(daysOutstanding);

  return {
    id: String(ticket.id),
    client_name: ticket.client_name,
    client_tel: ticket.client_tel,
    ticket_date: ticketDate,
    created_at: createdAt,
    total: ticket.total,
    paid: ticket.paid,
    finished: ticket.finished,
    company_id: ticket.company_id,
    balanceDue,
    paymentStatus,
    daysOutstanding,
    agingBucket,
    last_payment_at: lastPaymentAt,
    services_summary: ticket.services_summary?.trim() || null,
  };
};

/** Moment the debt started counting: last payment, else the work date. */
const getRowReference = (row: CobranzaRow): number =>
  (
    row.last_payment_at ??
    getCobranzaReferenceDate(row.ticket_date, row.created_at)
  ).getTime();

/**
 * Default order (ZIG-I18-2): longest without a payment first, then the larger
 * saldo, then the lower ticket id so ties are stable.
 */
export const compareCobranzaUrgency = (a: CobranzaRow, b: CobranzaRow): number => {
  const aRef = getRowReference(a);
  const bRef = getRowReference(b);
  if (aRef !== bRef) return aRef - bRef;

  if (a.balanceDue !== b.balanceDue) return b.balanceDue - a.balanceDue;

  return Number(a.id) - Number(b.id);
};

export const sortCobranzaRows = (
  rows: CobranzaRow[],
  sort: CobranzaSort,
): CobranzaRow[] => {
  const next = [...rows];
  if (sort === 'balance') {
    next.sort(
      (a, b) =>
        b.balanceDue - a.balanceDue ||
        compareCobranzaUrgency(a, b),
    );
  } else if (sort === 'recent') {
    next.sort(
      (a, b) =>
        getCobranzaReferenceDate(b.ticket_date, b.created_at).getTime() -
          getCobranzaReferenceDate(a.ticket_date, a.created_at).getTime() ||
        Number(b.id) - Number(a.id),
    );
  } else {
    next.sort(compareCobranzaUrgency);
  }
  return next;
};

export const buildCobranzaRows = (
  tickets: CobranzaTicketInput[],
  now: Date = new Date(),
): CobranzaRow[] => {
  const rows: CobranzaRow[] = [];
  for (const ticket of tickets) {
    const row = toCobranzaRow(ticket, now);
    if (row) rows.push(row);
  }
  rows.sort(compareCobranzaUrgency);
  return rows;
};

export const filterCobranzaRows = (
  rows: CobranzaRow[],
  options: {
    status?: CobranzaStatusFilter;
    aging?: CobranzaAgingBucket;
    search?: string;
  },
): CobranzaRow[] => {
  const status = options.status ?? 'all';
  const aging = options.aging ?? 'all';
  const search = options.search?.trim().toLowerCase() ?? '';

  return rows.filter((row) => {
    if (status !== 'all' && row.paymentStatus !== status) {
      return false;
    }
    if (aging !== 'all' && row.agingBucket !== aging) {
      return false;
    }
    if (search) {
      const haystack = `${row.client_name ?? ''} ${row.id}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    return true;
  });
};

export const summarizeCobranzaRows = (
  rows: CobranzaRow[],
): { count: number; balanceSum: number } => {
  let balanceSum = 0;
  for (const row of rows) {
    balanceSum += row.balanceDue;
  }
  return { count: rows.length, balanceSum };
};

/**
 * Apply a collect-payment result to the Cobranza queue.
 * Fully paid Tickets drop out; partials update paid/saldo/status.
 */
export const applyCobranzaPaymentToRows = (
  rows: CobranzaRow[],
  payment: { ticketId: number; paid: number; total: number | null },
  now: Date = new Date(),
): CobranzaRow[] => {
  const next: CobranzaRow[] = [];
  for (const row of rows) {
    if (Number(row.id) !== payment.ticketId) {
      next.push(row);
      continue;
    }
    const updated = toCobranzaRow(
      {
        id: row.id,
        client_name: row.client_name,
        client_tel: row.client_tel,
        ticket_date: row.ticket_date,
        created_at: row.created_at,
        total: payment.total,
        paid: payment.paid,
        finished: row.finished,
        company_id: row.company_id,
        last_payment_at: now,
        services_summary: row.services_summary,
      },
      now,
    );
    if (updated) {
      next.push(updated);
    }
  }
  next.sort(compareCobranzaUrgency);
  return next;
};

export const COBRANZA_AGING_LABEL: Record<CobranzaAgingBucket, string> = {
  all: 'Todos los plazos',
  '0-14': '0–14 días',
  '15-30': '15–30 días',
  '30+': 'Más de 30 días',
};

export const COBRANZA_STATUS_FILTER_LABEL: Record<CobranzaStatusFilter, string> =
  {
    all: 'Todos',
    pending: 'Pendiente',
    partial: 'Pago parcial',
  };
