'use server';

import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  client,
  service,
  ticket,
  type ClientRow,
  type ServiceRow,
} from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  checkPermission,
  requireActionAuth,
  requireActionPermission,
} from '@/lib/security';
import { recordResourceAudit } from '@/lib/resource-audit';
import { recordTicketAudit } from '@/lib/ticket-audit';

export type TrashTicket = {
  id: string;
  client_name: string | null;
  total: number | null;
  deleted_at: Date | null;
};

export type TrashContents = {
  clients: ClientRow[];
  services: ServiceRow[];
  tickets: TrashTicket[];
};

/** Lists soft-deleted records the caller may restore, scoped to their company. */
export async function getTrash(): Promise<{
  success: boolean;
  data?: TrashContents;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const context = await requireActionAuth();
    const companyId = context.companyId;
    if (!companyId) {
      return {
        success: true,
        data: { clients: [], services: [], tickets: [] },
      };
    }

    const [canClients, canServices, canTickets] = await Promise.all([
      checkPermission(context.userId, companyId, 'clients.read'),
      checkPermission(context.userId, companyId, 'services.read'),
      checkPermission(context.userId, companyId, 'tickets.read'),
    ]);

    const clients = canClients
      ? await db
          .select()
          .from(client)
          .where(
            and(
              eq(client.company_id, companyId),
              isNotNull(client.deleted_at),
            ),
          )
          .orderBy(desc(client.deleted_at))
      : [];

    const services = canServices
      ? await db
          .select()
          .from(service)
          .where(
            and(
              eq(service.company_id, companyId),
              isNotNull(service.deleted_at),
            ),
          )
          .orderBy(desc(service.deleted_at))
      : [];

    const ticketRows = canTickets
      ? await db
          .select()
          .from(ticket)
          .where(
            and(
              eq(ticket.company_id, companyId),
              isNotNull(ticket.deleted_at),
            ),
          )
          .orderBy(desc(ticket.deleted_at))
      : [];

    return {
      success: true,
      data: {
        clients,
        services,
        tickets: ticketRows.map((row) => ({
          id: row.id.toString(),
          client_name: row.client_name,
          total: row.total,
          deleted_at: row.deleted_at,
        })),
      },
    };
  } catch (e) {
    return handleCodedServerActionError('trash.list', 'GN001', e);
  }
}

export async function restoreClient(id: number): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId } = await requireActionPermission('clients.write');

    const existing = await db.query.client.findFirst({
      where: and(eq(client.id, id), eq(client.company_id, companyId)),
    });
    if (!existing || existing.deleted_at === null) {
      return buildActionError('CL006');
    }

    const [restored] = await db
      .update(client)
      .set({ deleted_at: null, updated_at: new Date() })
      .where(and(eq(client.id, id), eq(client.company_id, companyId)))
      .returning();

    await recordResourceAudit(db, {
      actor: context,
      resourceType: 'client',
      resourceId: id,
      targetCompanyId: companyId,
      action: 'updated',
      before: existing,
      after: restored,
      source: 'action',
    });

    revalidatePath('/clients');
    revalidatePath('/trash');
    return { success: true };
  } catch (e) {
    return handleCodedServerActionError('trash.restore-client', 'CL001', e);
  }
}

export async function restoreService(id: number): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId } =
      await requireActionPermission('services.write');

    const existing = await db.query.service.findFirst({
      where: and(eq(service.id, id), eq(service.company_id, companyId)),
    });
    if (!existing || existing.deleted_at === null) {
      return buildActionError('SV001');
    }

    const [restored] = await db
      .update(service)
      .set({ deleted_at: null, updated_at: new Date() })
      .where(and(eq(service.id, id), eq(service.company_id, companyId)))
      .returning();

    await recordResourceAudit(db, {
      actor: context,
      resourceType: 'service',
      resourceId: id,
      targetCompanyId: companyId,
      action: 'updated',
      before: existing,
      after: restored,
      source: 'action',
    });

    revalidatePath('/services');
    revalidatePath('/trash');
    return { success: true };
  } catch (e) {
    return handleCodedServerActionError('trash.restore-service', 'SV001', e);
  }
}

export async function restoreTicket(id: number): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId } = await requireActionPermission('tickets.write');
    const ticketId = BigInt(id);

    const existing = await db.query.ticket.findFirst({
      where: and(eq(ticket.id, ticketId), eq(ticket.company_id, companyId)),
    });
    if (!existing || existing.deleted_at === null) {
      return buildActionError('TC008');
    }

    const [restored] = await db
      .update(ticket)
      .set({ deleted_at: null, updated_at: new Date() })
      .where(and(eq(ticket.id, ticketId), eq(ticket.company_id, companyId)))
      .returning();

    await recordTicketAudit(db, context, ticketId, companyId, 'updated', {
      restored: true,
      before: existing,
      after: restored,
    });

    revalidatePath('/tickets');
    revalidatePath('/trash');
    return { success: true };
  } catch (e) {
    return handleCodedServerActionError('trash.restore-ticket', 'TC008', e);
  }
}
