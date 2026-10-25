import { differenceInCalendarDays } from 'date-fns';

import type { PresupuestoDetailData } from '@/actions/presupuestos';
import { formatClientAddressOneLine } from '@/lib/client-address';
import { formatDocumentFolio } from '@/lib/folio';
import { materialDraftsFromStoredRows } from '@/lib/material-drafts';
import { buildReviewLine } from '@/lib/review-lines';
import { getServiceLineName } from '@/lib/service-line-display';
import { getPresupuestoStatus } from '@/lib/ticket-document-kind';
import { buildTicketPdfFileName } from '@/lib/ticket-pdf-data';

const toIso = (value: Date | string | null | undefined): string | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const trimmed = (value: string | null | undefined): string | null => {
  const text = value?.trim();
  return text ? text : null;
};

/** Server row → PresupuestoView props (shared by /presupuestos/[id] and /listo). */
export const buildPresupuestoViewProps = (row: PresupuestoDetailData) => ({
  presupuestoId: String(row.id),
  folio: formatDocumentFolio({ ...row, document_kind: 'presupuesto' }),
  clientId: row.client_id,
  clientName: row.client_name,
  clientTel: row.client_tel,
  clientPhone: trimmed(row.client?.phone),
  clientEmail: trimmed(row.client?.email) ?? trimmed(row.email),
  clientAddress: row.client ? trimmed(formatClientAddressOneLine(row.client)) : null,
  ticketDate: toIso(row.ticket_date),
  expiresAt: toIso(row.expires_at),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
  workNotes: row.work_notes,
  total: Number(row.total) || 0,
  lines: row.services_tickets.map(buildReviewLine),
  status: getPresupuestoStatus(row),
  convertedToTicketId:
    row.converted_to_ticket_id != null ? String(row.converted_to_ticket_id) : null,
  downloadFileName: buildTicketPdfFileName(row),
});

/** Server row → composer edit state (ZIG-I5-5); inline lines stay inline. */
export const buildPresupuestoEditState = (row: PresupuestoDetailData) => ({
  id: String(row.id),
  folio: formatDocumentFolio({ ...row, document_kind: 'presupuesto' }),
  client: {
    id: row.client_id ?? 0,
    label: row.client_tel
      ? `${row.client_name ?? 'Cliente'} · ${row.client_tel}`
      : (row.client_name ?? 'Cliente'),
  },
  ticketDate: (row.ticket_date ? new Date(row.ticket_date) : new Date()).toISOString(),
  expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  notes: row.work_notes ?? '',
  lines: row.services_tickets.map((line) => {
    // Saved materials come back as drafts (ZIG-I10); catalog ones stay linked.
    const materials = materialDraftsFromStoredRows(line.materials);
    const withMaterials = materials.length > 0 ? { materials } : {};
    return line.service_id == null
      ? {
          key: `line-${String(line.id)}`,
          kind: 'custom' as const,
          service_id: null,
          service_name: getServiceLineName(line),
          ...(line.description ? { description: line.description } : {}),
          save_to_catalog: false,
          quantity: line.quantity,
          price: Number(line.price) || 0,
          ...withMaterials,
        }
      : {
          key: `line-${String(line.id)}`,
          kind: 'catalog' as const,
          service_id: line.service_id,
          service_name: getServiceLineName(line),
          quantity: line.quantity,
          price: Number(line.price) || 0,
          ...withMaterials,
        };
  }),
});

/**
 * Draft for Duplicar (ZIG-I13-5): the same client, lines (catalog and typed-in)
 * and materials in the presupuesto composer, dated today with the same validity
 * length. Nothing is saved until Guardar.
 */
export const buildPresupuestoDuplicateDraft = (row: PresupuestoDetailData, now: Date = new Date()) => {
  const edit = buildPresupuestoEditState(row);
  const issued = row.ticket_date ? new Date(row.ticket_date) : null;
  const expires = row.expires_at ? new Date(row.expires_at) : null;
  const validityDays =
    issued && expires ? Math.max(differenceInCalendarDays(expires, issued), 0) : null;
  return {
    client: edit.client,
    ticketDate: now.toISOString(),
    expiresAt:
      validityDays == null
        ? null
        : new Date(now.getTime() + validityDays * 86_400_000).toISOString(),
    notes: edit.notes,
    lines: edit.lines,
  };
};

export type PresupuestoDuplicateDraft = ReturnType<typeof buildPresupuestoDuplicateDraft>;
