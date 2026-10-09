import type { PresupuestoDetailData } from '@/actions/presupuestos';
import { getServiceLineName } from '@/lib/service-line-display';
import { getPresupuestoStatus } from '@/lib/ticket-document-kind';
import { buildTicketPdfFileName } from '@/lib/ticket-pdf-data';

/** Server row → PresupuestoView props (shared by /presupuestos/[id] and /listo). */
export const buildPresupuestoViewProps = (row: PresupuestoDetailData) => ({
  presupuestoId: String(row.id),
  clientId: row.client_id,
  clientName: row.client_name,
  clientTel: row.client_tel,
  ticketDate: row.ticket_date ? new Date(row.ticket_date).toISOString() : null,
  expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  workNotes: row.work_notes,
  total: Number(row.total) || 0,
  lines: row.services_tickets.map((line) => ({
    id: Number(line.id),
    serviceId: line.service_id,
    name: getServiceLineName(line),
    quantity: line.quantity,
    price: Number(line.price) || 0,
  })),
  status: getPresupuestoStatus(row),
  convertedToTicketId:
    row.converted_to_ticket_id != null ? String(row.converted_to_ticket_id) : null,
  downloadFileName: buildTicketPdfFileName(row),
});

/** Server row → composer edit state (ZIG-I5-5); inline lines stay inline. */
export const buildPresupuestoEditState = (row: PresupuestoDetailData) => ({
  id: String(row.id),
  client: {
    id: row.client_id ?? 0,
    label: row.client_tel
      ? `${row.client_name ?? 'Cliente'} · ${row.client_tel}`
      : (row.client_name ?? 'Cliente'),
  },
  ticketDate: (row.ticket_date ? new Date(row.ticket_date) : new Date()).toISOString(),
  expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  notes: row.work_notes ?? '',
  lines: row.services_tickets.map((line) =>
    line.service_id == null
      ? {
          key: `line-${String(line.id)}`,
          kind: 'custom' as const,
          service_id: null,
          service_name: getServiceLineName(line),
          ...(line.description ? { description: line.description } : {}),
          save_to_catalog: false,
          quantity: line.quantity,
          price: Number(line.price) || 0,
        }
      : {
          key: `line-${String(line.id)}`,
          kind: 'catalog' as const,
          service_id: line.service_id,
          service_name: getServiceLineName(line),
          quantity: line.quantity,
          price: Number(line.price) || 0,
        },
  ),
});
