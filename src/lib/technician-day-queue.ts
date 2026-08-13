/**
 * Technician day-queue helpers — unfinished Tickets for today + overdue.
 */

import { startOfDay } from 'date-fns';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { isWorkTicket } from '@/lib/ticket-document-kind';

export type TechnicianDayTicketInput = {
  id: bigint | string | number;
  client_name: string | null;
  client_tel: string | null;
  ticket_date: Date | string | null;
  created_at: Date | string;
  total: number | null;
  paid: number | null;
  finished: boolean;
  document_kind?: string | null;
  /** Service names already resolved for the ticket (active line items). */
  serviceNames?: Array<string | null | undefined>;
};

export type TechnicianDayTicket = {
  id: string;
  clientName: string | null;
  clientTel: string | null;
  ticketDate: string;
  total: number | null;
  paid: number | null;
  finished: boolean;
  balanceDue: number;
  paymentStatus: TicketPaymentStatus;
  isOverdue: boolean;
  servicesSummary: string | null;
};

/** Compact Spanish summary of ticket services for day-view cards. */
export const formatTechnicianDayServicesSummary = (
  serviceNames: Array<string | null | undefined> | undefined,
  maxNames = 3,
): string | null => {
  if (!serviceNames?.length) return null;
  const names = serviceNames
    .map((name) => name?.trim())
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return null;
  if (names.length <= maxNames) {
    return names.join(', ');
  }
  const visible = names.slice(0, maxNames).join(', ');
  const rest = names.length - maxNames;
  return `${visible} +${rest} más`;
};

const toDate = (value: Date | string | null | undefined): Date | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getTicketWorkDate = (
  ticketDate: Date | string | null | undefined,
  createdAt: Date | string,
): Date => toDate(ticketDate) ?? toDate(createdAt) ?? new Date(0);

/** Unfinished tickets dated today or earlier (overdue unfinished). */
export const isTechnicianDayQueueTicket = (
  ticket: TechnicianDayTicketInput,
  today: Date = new Date(),
): boolean => {
  if (!isWorkTicket(ticket.document_kind)) return false;
  if (ticket.finished) return false;
  const workDate = startOfDay(getTicketWorkDate(ticket.ticket_date, ticket.created_at));
  const todayStart = startOfDay(today);
  return workDate.getTime() <= todayStart.getTime();
};

export const toTechnicianDayTicket = (
  ticket: TechnicianDayTicketInput,
  today: Date = new Date(),
): TechnicianDayTicket | null => {
  if (!isTechnicianDayQueueTicket(ticket, today)) {
    return null;
  }
  const workDate = getTicketWorkDate(ticket.ticket_date, ticket.created_at);
  const todayStart = startOfDay(today);
  const isOverdue = startOfDay(workDate).getTime() < todayStart.getTime();

  return {
    id: String(ticket.id),
    clientName: ticket.client_name,
    clientTel: ticket.client_tel,
    ticketDate: workDate.toISOString(),
    total: ticket.total,
    paid: ticket.paid,
    finished: ticket.finished,
    balanceDue: getTicketBalanceDue(ticket.total, ticket.paid),
    paymentStatus: getTicketPaymentStatus(ticket.total, ticket.paid),
    isOverdue,
    servicesSummary: formatTechnicianDayServicesSummary(ticket.serviceNames),
  };
};

/** Write CTAs for day-view cards (finish/edit + collect when finished + saldo). */
export const getTechnicianDayCardActions = (input: {
  finished: boolean;
  balanceDue: number;
  canWrite: boolean;
}): { showOpenEdit: boolean; showCollect: boolean } => {
  const showOpenEdit = input.canWrite && !input.finished;
  const showCollect =
    input.canWrite && input.finished && input.balanceDue > 0;
  return { showOpenEdit, showCollect };
};

/** Overdue first, then today by date/id. */
export const compareTechnicianDayUrgency = (
  a: TechnicianDayTicket,
  b: TechnicianDayTicket,
): number => {
  if (a.isOverdue !== b.isOverdue) {
    return a.isOverdue ? -1 : 1;
  }
  const byDate =
    new Date(a.ticketDate).getTime() - new Date(b.ticketDate).getTime();
  if (byDate !== 0) return byDate;
  return Number(a.id) - Number(b.id);
};

export const buildTechnicianDayQueue = (
  tickets: TechnicianDayTicketInput[],
  today: Date = new Date(),
): { items: TechnicianDayTicket[]; todayCount: number; overdueCount: number } => {
  const items: TechnicianDayTicket[] = [];
  for (const ticket of tickets) {
    const row = toTechnicianDayTicket(ticket, today);
    if (row) items.push(row);
  }
  items.sort(compareTechnicianDayUrgency);
  return {
    items,
    todayCount: items.filter((row) => !row.isOverdue).length,
    overdueCount: items.filter((row) => row.isOverdue).length,
  };
};
