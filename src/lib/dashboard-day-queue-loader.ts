/**
 * Server-side loader for Inicio «Tu día». Callers must already have authorized
 * `companyId` (page: session company; action: requireTicketRead). Not a server
 * action on purpose: it takes a raw company id.
 */

import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import {
  clientServiceSchedule,
  servicesTickets,
  ticket,
} from '@/db/schema';
import { db } from '@/lib/db';
import { buildCobranzaRows } from '@/lib/cobranza';
import {
  buildDashboardDayQueue,
  type DashboardDayQueue,
} from '@/lib/dashboard-day-queue';
import { buildTechnicianDayQueue } from '@/lib/technician-day-queue';

export const loadDashboardDayQueueForCompany = async (
  companyId: number,
  today: Date = new Date(),
): Promise<DashboardDayQueue> => {
  const [unfinished, finished, schedules] = await Promise.all([
    db.query.ticket.findMany({
      where: and(
        eq(ticket.company_id, companyId),
        isNull(ticket.deleted_at),
        eq(ticket.finished, false),
        eq(ticket.document_kind, 'ticket'),
      ),
      with: {
        services_tickets: {
          where: isNull(servicesTickets.deleted_at),
          with: { service: true },
        },
      },
      orderBy: [desc(ticket.ticket_date), desc(ticket.created_at)],
    }),
    db.query.ticket.findMany({
      where: and(
        eq(ticket.company_id, companyId),
        isNull(ticket.deleted_at),
        eq(ticket.finished, true),
        eq(ticket.document_kind, 'ticket'),
      ),
    }),
    db.query.clientServiceSchedule.findMany({
      where: and(
        eq(clientServiceSchedule.company_id, companyId),
        isNull(clientServiceSchedule.deleted_at),
        isNull(clientServiceSchedule.paused_at),
      ),
      with: { client: true, service: true },
      orderBy: [asc(clientServiceSchedule.next_due_at)],
    }),
  ]);

  const { items: dayTickets } = buildTechnicianDayQueue(
    unfinished.map((row) => ({
      id: row.id,
      client_name: row.client_name,
      client_tel: row.client_tel,
      ticket_date: row.ticket_date,
      created_at: row.created_at,
      total: row.total,
      paid: row.paid,
      finished: row.finished,
      document_kind: row.document_kind,
      serviceNames: row.services_tickets.map((line) => line.service?.name ?? null),
    })),
    today,
  );

  const cobranzaRows = buildCobranzaRows(
    finished.map((row) => ({
      id: row.id,
      client_name: row.client_name,
      client_tel: row.client_tel,
      ticket_date: row.ticket_date,
      created_at: row.created_at,
      total: row.total,
      paid: row.paid,
      finished: row.finished,
      company_id: row.company_id,
      document_kind: row.document_kind,
    })),
    today,
  );

  return buildDashboardDayQueue({
    dayTickets,
    cobranzaRows,
    schedules: schedules
      .filter((row) => row.client.deleted_at === null && row.service.deleted_at === null)
      .map((row) => ({
        id: row.id,
        clientId: row.client_id,
        clientName: row.client.name,
        clientPhone: row.client.phone ?? null,
        serviceId: row.service_id,
        serviceName: row.service.name,
        nextDueAt: row.next_due_at,
        pausedAt: row.paused_at,
      })),
    today,
  });
};
