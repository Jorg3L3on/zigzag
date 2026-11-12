'use server';

import { and, countDistinct, eq, isNull } from 'drizzle-orm';
import { servicesTickets, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import { handleCodedServerActionError, type ActionErrorType } from '@/lib/errors';
import { requireTenantActionPermission } from '@/lib/security';

export type ServiceUsage = {
  /** Work tickets not finished yet that have a line of this service. */
  openTickets: number;
  /** Presupuestos still open (not canceled or converted) with a line of it. */
  openPresupuestos: number;
};

/** What still uses a catalog service, for the Eliminar servicio dialog (M-36). */
export async function getServiceUsage(
  id: number,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: ServiceUsage;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireTenantActionPermission(
      'services.write',
      companyId,
    );
    const lineOfService = and(
      eq(servicesTickets.service_id, id),
      isNull(servicesTickets.deleted_at),
      eq(ticket.company_id, effectiveCompanyId),
      isNull(ticket.deleted_at),
    );
    const [tickets] = await db
      .select({ total: countDistinct(ticket.id) })
      .from(servicesTickets)
      .innerJoin(ticket, eq(ticket.id, servicesTickets.ticket_id))
      .where(and(lineOfService, eq(ticket.document_kind, 'ticket'), eq(ticket.finished, false)));
    const [presupuestos] = await db
      .select({ total: countDistinct(ticket.id) })
      .from(servicesTickets)
      .innerJoin(ticket, eq(ticket.id, servicesTickets.ticket_id))
      .where(
        and(
          lineOfService,
          eq(ticket.document_kind, 'presupuesto'),
          isNull(ticket.canceled_at),
          isNull(ticket.converted_to_ticket_id),
        ),
      );
    return {
      success: true,
      data: {
        openTickets: Number(tickets?.total ?? 0),
        openPresupuestos: Number(presupuestos?.total ?? 0),
      },
    };
  } catch (error) {
    return handleCodedServerActionError('services.usage', 'SV004', error);
  }
}
