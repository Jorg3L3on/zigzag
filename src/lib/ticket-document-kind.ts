/**
 * Ticket document kind helpers — work Tickets vs Presupuestos (quotes).
 */

export const TICKET_DOCUMENT_KINDS = ['ticket', 'presupuesto'] as const;
export type TicketDocumentKind = (typeof TICKET_DOCUMENT_KINDS)[number];

export const TICKET_DOCUMENT_KIND_LABEL: Record<TicketDocumentKind, string> = {
  ticket: 'Ticket',
  presupuesto: 'Presupuesto',
};

export type PresupuestoStatus =
  | 'abierto'
  | 'vencido'
  | 'convertido'
  | 'cancelado';

export const PRESUPUESTO_STATUS_LABEL: Record<PresupuestoStatus, string> = {
  abierto: 'Abierto',
  vencido: 'Vencido',
  convertido: 'Convertido',
  cancelado: 'Cancelado',
};

export const isTicketDocumentKind = (
  value: string | null | undefined,
): value is TicketDocumentKind =>
  value === 'ticket' || value === 'presupuesto';

export const normalizeTicketDocumentKind = (
  value: string | null | undefined,
): TicketDocumentKind => (value === 'presupuesto' ? 'presupuesto' : 'ticket');

/** True for executed/work Tickets (not quotes). Null/unknown → work ticket. */
export const isWorkTicket = (
  documentKind: string | null | undefined,
): boolean => normalizeTicketDocumentKind(documentKind) === 'ticket';

export const isPresupuestoTicket = (
  documentKind: string | null | undefined,
): boolean => normalizeTicketDocumentKind(documentKind) === 'presupuesto';

export type PresupuestoStatusInput = {
  document_kind?: string | null;
  expires_at?: Date | string | null;
  canceled_at?: Date | string | null;
  converted_to_ticket_id?: bigint | string | number | null;
};

const toDateOrNull = (value: Date | string | null | undefined): Date | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfLocalDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const getPresupuestoStatus = (
  input: PresupuestoStatusInput,
  today: Date = new Date(),
): PresupuestoStatus => {
  if (input.canceled_at != null) {
    return 'cancelado';
  }
  if (input.converted_to_ticket_id != null) {
    return 'convertido';
  }
  const expiresAt = toDateOrNull(input.expires_at);
  if (
    expiresAt &&
    startOfLocalDay(expiresAt).getTime() < startOfLocalDay(today).getTime()
  ) {
    return 'vencido';
  }
  return 'abierto';
};

/** Open quotes that can still be edited / converted. */
export const isPresupuestoMutable = (
  input: PresupuestoStatusInput,
  today: Date = new Date(),
): boolean => {
  if (!isPresupuestoTicket(input.document_kind)) {
    return false;
  }
  const status = getPresupuestoStatus(input, today);
  return status === 'abierto' || status === 'vencido';
};

/** Finish/payment only allowed on work Tickets. */
export const assertWorkTicketMutationAllowed = (
  documentKind: string | null | undefined,
): void => {
  if (!isWorkTicket(documentKind)) {
    throw new Error('PRESUPUESTO_MUTATION_BLOCKED');
  }
};
