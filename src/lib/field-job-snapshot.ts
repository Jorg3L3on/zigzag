/**
 * Unified field job snapshot for Hoy cards, Anotar success, and offline queue.
 * Adapters map server day-queue / cobranza rows until offline sync lands.
 */

import {
  compareCobranzaUrgency,
  type CobranzaRow,
} from '@/lib/cobranza';
import {
  isPresupuestoMutable,
  isPresupuestoTicket,
  isWorkTicket,
  normalizeTicketDocumentKind,
  type TicketDocumentKind,
} from '@/lib/ticket-document-kind';
import { getTicketBalanceDue } from '@/lib/ticket-payment-status';
import type { TechnicianDayTicket } from '@/lib/technician-day-queue';

export type FieldJobSnapshot = {
  /** Server ticket id when synced; null while pending upload. */
  ticketId: string | null;
  localJobId?: string | null;
  clientName: string | null;
  clientTel: string | null;
  servicesSummary: string | null;
  workNotesSummary?: string | null;
  total: number;
  paid: number;
  balanceDue: number;
  finished: boolean;
  documentKind: TicketDocumentKind;
  ticketDate: string | null;
  companyId?: number | null;
  companyName?: string | null;
  /** Open presupuesto still editable/convertible. */
  presupuestoMutable?: boolean;
  validUntil?: string | null;
  isOverdue?: boolean;
  pendingSync?: boolean;
};

export type FieldSendOptionId =
  | 'voy_en_camino'
  | 'recordar_saldo'
  | 'enviar_presupuesto'
  | 'enviar_recibo';

export type FieldSendOption = {
  id: FieldSendOptionId;
  label: string;
  /** When false, show disabled with helper text. */
  enabled: boolean;
  disabledReason?: string;
  /** Preferred highlight after Anotar save. */
  highlight?: boolean;
};

export const toFieldJobSnapshotFromDayTicket = (
  item: TechnicianDayTicket,
  options?: { companyId?: number | null; companyName?: string | null },
): FieldJobSnapshot => ({
  ticketId: item.id,
  clientName: item.clientName,
  clientTel: item.clientTel,
  servicesSummary: item.servicesSummary,
  total: item.total ?? 0,
  paid: item.paid ?? 0,
  balanceDue: item.balanceDue,
  finished: item.finished,
  documentKind: 'ticket',
  ticketDate: item.ticketDate,
  companyId: options?.companyId,
  companyName: options?.companyName,
  isOverdue: item.isOverdue,
  pendingSync: false,
});

export const toFieldJobSnapshotFromCobranzaRow = (
  row: CobranzaRow,
  options?: { companyName?: string | null },
): FieldJobSnapshot => ({
  ticketId: row.id,
  clientName: row.client_name,
  clientTel: row.client_tel,
  servicesSummary: null,
  total: row.total ?? 0,
  paid: row.paid ?? 0,
  balanceDue: row.balanceDue,
  finished: row.finished,
  documentKind: 'ticket',
  ticketDate: row.ticket_date?.toISOString() ?? null,
  companyId: row.company_id,
  companyName: options?.companyName,
  pendingSync: false,
});

export type AnotarSuccessSnapshotInput = {
  ticketId: string | number | null;
  localJobId?: string | null;
  clientName: string | null;
  clientTel: string | null;
  workNotes?: string | null;
  total: number;
  paid: number;
  finished: boolean;
  documentKind?: string | null;
  companyId?: number | null;
  companyName?: string | null;
  validUntil?: string | null;
};

export const toFieldJobSnapshotFromAnotarSuccess = (
  input: AnotarSuccessSnapshotInput,
): FieldJobSnapshot => {
  const documentKind = normalizeTicketDocumentKind(input.documentKind);
  const total = input.total;
  const paid = input.paid;
  return {
    ticketId: input.ticketId != null ? String(input.ticketId) : null,
    localJobId: input.localJobId ?? null,
    clientName: input.clientName,
    clientTel: input.clientTel,
    servicesSummary: null,
    workNotesSummary: input.workNotes?.trim() || null,
    total,
    paid,
    balanceDue: getTicketBalanceDue(total, paid),
    finished: input.finished,
    documentKind,
    ticketDate: new Date().toISOString(),
    companyId: input.companyId,
    companyName: input.companyName,
    presupuestoMutable: isPresupuestoMutable({
      document_kind: documentKind,
      expires_at: input.validUntil,
    }),
    validUntil: input.validUntil ?? null,
    pendingSync: input.ticketId == null,
  };
};

const NO_PHONE = 'Agrega un teléfono al cliente';

/**
 * Contextual WhatsApp / Enviar menu options for a field job snapshot.
 */
export const getFieldSendOptions = (
  job: FieldJobSnapshot,
  options?: { online?: boolean; highlightId?: FieldSendOptionId | null },
): FieldSendOption[] => {
  const hasPhone = Boolean(job.clientTel?.trim());
  const isQuote = isPresupuestoTicket(job.documentKind);
  const isWork = isWorkTicket(job.documentKind);
  const mutableQuote =
    job.presupuestoMutable ??
    isPresupuestoMutable({
      document_kind: job.documentKind,
      expires_at: job.validUntil,
    });
  const highlightId = options?.highlightId ?? getDefaultFieldSendHighlight(job);

  const result: FieldSendOption[] = [];

  if (isWork && !job.finished) {
    result.push({
      id: 'voy_en_camino',
      label: 'Voy en camino',
      enabled: hasPhone,
      disabledReason: hasPhone ? undefined : NO_PHONE,
      highlight: highlightId === 'voy_en_camino',
    });
  }

  if (isQuote && mutableQuote) {
    result.push({
      id: 'enviar_presupuesto',
      label: 'Enviar presupuesto',
      enabled: hasPhone,
      disabledReason: hasPhone ? undefined : NO_PHONE,
      highlight: highlightId === 'enviar_presupuesto',
    });
  }

  if (isWork && job.finished) {
    result.push({
      id: 'enviar_recibo',
      label:
        options?.online === false
          ? 'Recibo simple (sin internet)'
          : 'Enviar recibo',
      enabled: hasPhone || Boolean(job.ticketId),
      disabledReason:
        hasPhone || job.ticketId
          ? undefined
          : 'Necesitas teléfono o un ticket sincronizado',
      highlight: highlightId === 'enviar_recibo',
    });
  }

  if (isWork && job.finished && job.balanceDue > 0) {
    result.push({
      id: 'recordar_saldo',
      label: 'Recordar saldo',
      enabled: hasPhone,
      disabledReason: hasPhone ? undefined : NO_PHONE,
      highlight: highlightId === 'recordar_saldo',
    });
  }

  return result;
};

export const getDefaultFieldSendHighlight = (
  job: FieldJobSnapshot,
): FieldSendOptionId | null => {
  if (isPresupuestoTicket(job.documentKind)) {
    return 'enviar_presupuesto';
  }
  if (job.finished && job.balanceDue <= 0) {
    return 'enviar_recibo';
  }
  if (job.finished && job.balanceDue > 0) {
    return 'enviar_recibo';
  }
  if (!job.finished) {
    return 'voy_en_camino';
  }
  return null;
};

/** Top N cobranza rows for Hoy strip (already urgency-sorted preferred). */
export const pickHoyCobranzaRows = (
  rows: CobranzaRow[],
  limit = 5,
): CobranzaRow[] =>
  [...rows].sort(compareCobranzaUrgency).slice(0, Math.max(0, limit));
