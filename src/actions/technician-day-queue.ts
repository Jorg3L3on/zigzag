'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { servicesTickets, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import {
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { requireTicketRead } from '@/lib/tickets-rbac-server';
import {
  buildTechnicianDayQueue,
  type TechnicianDayTicket,
} from '@/lib/technician-day-queue';

export type TechnicianDayQueueData = {
  items: TechnicianDayTicket[];
  todayCount: number;
  overdueCount: number;
};

export async function getTechnicianDayQueue(
  companyId: number | null,
): Promise<{
  success: boolean;
  data?: TechnicianDayQueueData;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireTicketRead(
      companyId ?? undefined,
    );

    const tickets = await db.query.ticket.findMany({
      where: and(
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
        eq(ticket.finished, false),
      ),
      with: {
        services_tickets: {
          where: isNull(servicesTickets.deleted_at),
          with: {
            service: true,
          },
        },
      },
      orderBy: [desc(ticket.ticket_date), desc(ticket.created_at)],
    });

    const queue = buildTechnicianDayQueue(
      tickets.map((row) => ({
        id: row.id,
        client_name: row.client_name,
        client_tel: row.client_tel,
        ticket_date: row.ticket_date,
        created_at: row.created_at,
        total: row.total,
        paid: row.paid,
        finished: row.finished,
        serviceNames: row.services_tickets.map(
          (line) => line.service?.name ?? null,
        ),
      })),
    );

    return { success: true, data: queue };
  } catch (e) {
    return handleCodedServerActionError(
      'technicianDayQueue.list',
      'TC002',
      e,
    );
  }
}
