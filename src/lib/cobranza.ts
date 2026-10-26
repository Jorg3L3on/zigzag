/**
 * Cobranza queue helpers — aging, urgency sort, and client-side filters.
 * Saldo/status always come from ticket-payment-status helpers.
 *
 * Rules (ZIG-I31, pinned decision a4628591): only finished work tickets with a
 * saldo are cobrables; days count from the work date (ticket_date, else
 * created_at) in the company's calendar, and the last payment is secondary.
 */

import { companyDay } from '@/lib/company-day';
import { formatDocumentFolio } from '@/lib/folio';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { isWorkTicket } from '@/lib/ticket-document-kind';

export type CobranzaAgingBucket = 'all' | '0-30' | '31-90' | '90+';

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
  client_id?: number | null;
  folio_number?: number | null;
  folio_prefix?: string | null;
  /** Latest payment on record; shown as «último pago», never the aging date. */
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
  client_id: number | null;
  folio: string;
  balanceDue: number;
  paymentStatus: TicketPaymentStatus;
  /** Days since the work date (ticket_date, else created_at), company calendar. */
  daysOutstanding: number;
  /** Days since the last payment; null when nothing was paid yet. */
  daysSinceLastPayment: number | null;
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

/** Whole company days (America/Mexico_City) from `referenceDate` to `now`. */
export const getDaysOutstanding = (
  referenceDate: Date,
  now: Date = new Date(),
): number => {
  const diff = Math.round(
    (companyDay(now).date.getTime() - companyDay(referenceDate).date.getTime()) /
      MS_PER_DAY,
  );
  return Math.max(0, diff);
};

export const getAgingBucket = (
  daysOutstanding: number,
): Exclude<CobranzaAgingBucket, 'all'> => {
  if (daysOutstanding <= 30) return '0-30';
  if (daysOutstanding <= 90) return '31-90';
  return '90+';
};

export const COBRANZA_AGING_BUCKETS = ['0-30', '31-90', '90+'] as const;

export const isCobranzaAgingBucket = (
  value: string | null | undefined,
): value is CobranzaAgingBucket =>
  value === 'all' ||
  value === '0-30' ||
  value === '31-90' ||
  value === '90+';

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

  // En proceso is not cobrable yet; it is collected when the work is finished.
  if (!ticket.finished) {
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
  const daysOutstanding = getDaysOutstanding(
    getCobranzaReferenceDate(ticketDate, createdAt),
    now,
  );
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
    client_id: ticket.client_id ?? null,
    folio: formatDocumentFolio(ticket),
    balanceDue,
    paymentStatus,
    daysOutstanding,
    daysSinceLastPayment: lastPaymentAt
      ? getDaysOutstanding(lastPaymentAt, now)
      : null,
    agingBucket,
    last_payment_at: lastPaymentAt,
    services_summary: ticket.services_summary?.trim() || null,
  };
};

/** Moment the debt started counting: the work date (ZIG-I31). */
const getRowReference = (row: CobranzaRow): number =>
  getCobranzaReferenceDate(row.ticket_date, row.created_at).getTime();

/**
 * Default order: oldest work first, then the larger saldo, then the lower
 * ticket id so ties are stable.
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
    /** Only the tickets of this client (ZIG-I17-2). */
    clientId?: number | null;
  },
): CobranzaRow[] => {
  const status = options.status ?? 'all';
  const aging = options.aging ?? 'all';
  const search = options.search?.trim().toLowerCase() ?? '';

  const clientId = options.clientId ?? null;

  return rows.filter((row) => {
    if (clientId != null && row.client_id !== clientId) {
      return false;
    }
    if (status !== 'all' && row.paymentStatus !== status) {
      return false;
    }
    if (aging !== 'all' && row.agingBucket !== aging) {
      return false;
    }
    if (search) {
      const haystack =
        `${row.client_name ?? ''} ${row.id} ${row.folio} ${row.client_tel ?? ''}`.toLowerCase();
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
        client_id: row.client_id,
        last_payment_at: now,
        services_summary: row.services_summary,
      },
      now,
    );
    if (updated) {
      // The row carries no folio parts; keep the folio it already showed.
      next.push({ ...updated, folio: row.folio });
    }
  }
  next.sort(compareCobranzaUrgency);
  return next;
};

export const COBRANZA_AGING_LABEL: Record<CobranzaAgingBucket, string> = {
  all: 'Todos los plazos',
  '0-30': '0–30 días',
  '31-90': '31–90 días',
  '90+': 'Más de 90 días',
};

export type CobranzaBucketTotals = { count: number; amount: number };

export type CobranzaBucketSummary = Record<CobranzaAgingBucket, CobranzaBucketTotals> & {
  /** Distinct clients behind `all` (client_id, else the name on the ticket). */
  clients: number;
  /** Mean of daysOutstanding over `all`, rounded; 0 when empty. */
  averageDays: number;
};

/** Grouping key: the client record, else the name snapshot on the ticket. */
export const cobranzaClientKey = (
  row: Pick<CobranzaRow, 'client_id' | 'client_name'>,
): string =>
  row.client_id != null
    ? `id:${row.client_id}`
    : `name:${(row.client_name ?? '').trim().toLocaleLowerCase('es')}`;

/** Count and saldo per aging bucket; `all` equals the sum of the three. */
export const summarizeCobranzaBuckets = (
  rows: CobranzaRow[],
): CobranzaBucketSummary => {
  const empty = (): CobranzaBucketTotals => ({ count: 0, amount: 0 });
  const summary: CobranzaBucketSummary = {
    all: empty(),
    '0-30': empty(),
    '31-90': empty(),
    '90+': empty(),
    clients: 0,
    averageDays: 0,
  };
  const clients = new Set<string>();
  let days = 0;
  for (const row of rows) {
    summary.all.count += 1;
    summary.all.amount += row.balanceDue;
    summary[row.agingBucket].count += 1;
    summary[row.agingBucket].amount += row.balanceDue;
    clients.add(cobranzaClientKey(row));
    days += row.daysOutstanding;
  }
  summary.clients = clients.size;
  summary.averageDays = rows.length > 0 ? Math.round(days / rows.length) : 0;
  return summary;
};

export type CobranzaClientGroup = {
  key: string;
  client_id: number | null;
  client_name: string | null;
  client_tel: string | null;
  /** Saldo of every ticket in the group. */
  balanceDue: number;
  /** Days of the oldest work in the group. */
  oldestDays: number;
  agingBucket: Exclude<CobranzaAgingBucket, 'all'>;
  last_payment_at: Date | null;
  tickets: CobranzaRow[];
};

/**
 * One group per client, larger saldo first. Tickets inside keep the urgency
 * order; the phone is the first one found on the client's tickets.
 */
export const groupCobranzaRowsByClient = (
  rows: CobranzaRow[],
): CobranzaClientGroup[] => {
  const groups = new Map<string, CobranzaClientGroup>();
  for (const row of [...rows].sort(compareCobranzaUrgency)) {
    const key = cobranzaClientKey(row);
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        key,
        client_id: row.client_id,
        client_name: row.client_name,
        client_tel: row.client_tel,
        balanceDue: row.balanceDue,
        oldestDays: row.daysOutstanding,
        agingBucket: row.agingBucket,
        last_payment_at: row.last_payment_at,
        tickets: [row],
      });
      continue;
    }
    group.tickets.push(row);
    group.balanceDue += row.balanceDue;
    if (row.daysOutstanding > group.oldestDays) {
      group.oldestDays = row.daysOutstanding;
      group.agingBucket = row.agingBucket;
    }
    if (!group.client_tel && row.client_tel) {
      group.client_tel = row.client_tel;
    }
    if (
      row.last_payment_at &&
      (!group.last_payment_at || row.last_payment_at > group.last_payment_at)
    ) {
      group.last_payment_at = row.last_payment_at;
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.balanceDue - a.balanceDue ||
      b.oldestDays - a.oldestDays ||
      a.key.localeCompare(b.key),
  );
};

export const COBRANZA_STATUS_FILTER_LABEL: Record<CobranzaStatusFilter, string> =
  {
    all: 'Todos',
    pending: 'Pendiente',
    partial: 'Pago parcial',
  };
