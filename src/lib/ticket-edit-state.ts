import { formatDisplayFolio } from '@/lib/folio';
import type { TicketDetailData } from '@/actions/tickets';
import { materialDraftsFromStoredRows } from '@/lib/material-drafts';
import { getServiceLineName } from '@/lib/service-line-display';
import type { TicketComposerDraftLine } from '@/lib/ticket-composer-draft';

type StoredLine = TicketDetailData['services_tickets'][number];

/** Server lines → composer lines; catalog lines stay linked, typed-in ones stay inline (ZIG-I13-6). */
export const buildComposerLinesFromTicket = (
  rows: ReadonlyArray<StoredLine>,
): TicketComposerDraftLine[] =>
  rows.map((line) => {
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
  });

const clientLabel = (name: string | null, phone: string | null) =>
  phone ? `${name ?? 'Cliente'} · ${phone}` : (name ?? 'Cliente');

/** Edit state of the ticket composer (ZIG-I13-6). */
export const buildTicketEditState = (row: TicketDetailData) => ({
  id: String(row.id),
  folio: formatDisplayFolio(row),
  client: {
    id: row.client_id ?? 0,
    label: clientLabel(row.client_name, row.client_tel),
    name: row.client_name ?? undefined,
    phone: row.client_tel,
  },
  ticketDate: (row.ticket_date ? new Date(row.ticket_date) : new Date()).toISOString(),
  expiresAt: null as string | null,
  notes: row.work_notes ?? '',
  lines: buildComposerLinesFromTicket(row.services_tickets),
  /** The saved total, for the "Antes $X · ±$Δ" bar. */
  originalTotal: Number(row.total) || 0,
  paid: Number(row.paid) || 0,
  finished: row.finished,
});

export type TicketEditState = ReturnType<typeof buildTicketEditState>;

/** Draft for Duplicar ticket: same client, lines and materials, today, nothing paid. */
export const buildTicketDuplicateDraft = (row: TicketDetailData, now: Date = new Date()) => ({
  client: {
    id: row.client_id ?? 0,
    label: clientLabel(row.client_name, row.client_tel),
  },
  ticketDate: now.toISOString(),
  notes: row.work_notes ?? '',
  lines: buildComposerLinesFromTicket(row.services_tickets),
});

export type TicketDuplicateDraft = ReturnType<typeof buildTicketDuplicateDraft>;
