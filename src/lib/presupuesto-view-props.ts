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
