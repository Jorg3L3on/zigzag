import type { ServicesTicketsRow, TicketRow } from '@/db/schema';

/** v1 list/get ticket fields — aligned with list_tickets (no tel, email, notes). */
export type AgentTicketPayload = {
  id: string;
  client_id: number | null;
  client_name: string | null;
  ticket_date: Date | null;
  total: string | null;
  paid: string | null;
  finished: boolean;
  company_id: number | null;
  created_at: Date;
  services_tickets?: Array<{
    id: number;
    service_id: number;
    quantity: number;
    price: string;
  }>;
};

type TicketSummaryPick = Pick<
  TicketRow,
  | 'id'
  | 'client_id'
  | 'client_name'
  | 'ticket_date'
  | 'total'
  | 'paid'
  | 'finished'
  | 'company_id'
  | 'created_at'
>;

type TicketLinePick = Pick<
  ServicesTicketsRow,
  'id' | 'service_id' | 'quantity' | 'price'
>;

export const mapAgentTicketSummary = (row: TicketSummaryPick): AgentTicketPayload => ({
  id: row.id.toString(),
  client_id: row.client_id,
  client_name: row.client_name,
  ticket_date: row.ticket_date,
  total: row.total,
  paid: row.paid,
  finished: row.finished,
  company_id: row.company_id,
  created_at: row.created_at,
});

export const mapAgentTicketDetail = (
  row: TicketSummaryPick & { services_tickets: TicketLinePick[] },
): AgentTicketPayload => ({
  ...mapAgentTicketSummary(row),
  services_tickets: row.services_tickets.map((line) => ({
    id: line.id,
    service_id: line.service_id,
    quantity: line.quantity,
    price: line.price,
  })),
});

export const parseAgentTicketId = (value: string | number): bigint => {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error('ticket_id inválido');
    }
    return BigInt(value);
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error('ticket_id inválido');
  }
  return BigInt(trimmed);
};
