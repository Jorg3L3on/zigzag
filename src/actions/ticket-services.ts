'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { ZodError } from 'zod';
import { service, servicesTickets, ticket } from '@/db/schema';
import type { Service } from '@/db/schema';
import { db } from '@/lib/db';
import {
  AuthorizationError,
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import type { ActionAuthContext } from '@/lib/authz-context';
import { invalidateCompanyCache } from '@/lib/cache';
import { requireTenantActionPermission } from '@/lib/security';
import { recordTicketAudit } from '@/lib/ticket-audit';
import { syncTicketTotal } from '@/lib/ticket-financials';
import { isTicketFullyPaid } from '@/lib/ticket-payment-status';
import {
  createServiceTicketSchema,
  serviceLineMoneySchema,
} from '@/lib/ticket-service-line-schema';
import { revalidatePath } from 'next/cache';

export interface ServiceTicket {
  id: number;
  service_id: number;
  quantity: number;
  price: number;
  service: Service;
}

type CreateServiceTicketData = import('@/lib/ticket-service-line-schema').CreateServiceTicketData;
type UpdateServiceTicketData = import('@/lib/ticket-service-line-schema').UpdateServiceTicketData;

const ticketIdBigInt = (ticketId: string) => BigInt(ticketId);

type PgError = {
  code?: string;
  constraint?: string;
};

type NetworkError = {
  code?: string;
  cause?: {
    code?: string;
  };
};

const isServicesTicketsPrimaryKeyConflict = (error: unknown): boolean => {
  const dbError = (error as { cause?: PgError })?.cause;
  return (
    dbError?.code === '23505' &&
    (dbError?.constraint === 'ServicesTickets_pkey' ||
      dbError?.constraint === 'servicestickets_pkey')
  );
};

const syncServicesTicketsIdSequence = async (): Promise<void> => {
  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('"ServicesTickets"', 'id'),
      COALESCE((SELECT MAX("id") FROM "ServicesTickets"), 0) + 1,
      false
    );
  `);
};

const isTransientNetworkError = (error: unknown): boolean => {
  const candidate = error as NetworkError;
  const errorCode = candidate?.code ?? candidate?.cause?.code;
  return (
    errorCode === 'ENOTFOUND' ||
    errorCode === 'EAI_AGAIN' ||
    errorCode === 'EHOSTUNREACH' ||
    errorCode === 'ECONNRESET' ||
    errorCode === 'ETIMEDOUT'
  );
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const assertTicketAccess = async (
  ticketId: bigint,
  permissionKey: string,
  companyId?: number | null,
): Promise<{
  companyId: number;
  context: ActionAuthContext;
  total: number | null;
  paid: number | null;
}> => {
  const { context, companyId: effectiveCompanyId } =
    await requireTenantActionPermission(permissionKey, companyId);

  const ticketRow = await db.query.ticket.findFirst({
    where: and(eq(ticket.id, ticketId), isNull(ticket.deleted_at)),
    columns: {
      company_id: true,
      total: true,
      paid: true,
    },
  });

  if (!ticketRow) {
    throw new AuthorizationError('Ticket not found');
  }

  if (ticketRow.company_id !== effectiveCompanyId) {
    throw new AuthorizationError('Access denied to this ticket');
  }

  return {
    companyId: effectiveCompanyId,
    context,
    total: ticketRow.total,
    paid: ticketRow.paid,
  };
};

class TicketAlreadyPaidError extends Error {
  constructor() {
    super('Ticket already fully paid');
    this.name = 'TicketAlreadyPaidError';
  }
}

const assertTicketNotFullyPaid = (total: number | null, paid: number | null) => {
  if (isTicketFullyPaid(total, paid)) {
    throw new TicketAlreadyPaidError();
  }
};

const assertServiceAvailable = async (serviceId: number, companyId: number) => {
  const serviceRow = await db.query.service.findFirst({
    where: and(
      eq(service.id, serviceId),
      eq(service.company_id, companyId),
      isNull(service.deleted_at),
    ),
  });

  if (!serviceRow) {
    throw new AuthorizationError('Service not found for this company');
  }

  return serviceRow;
};

const resolveServiceNameById = async (
  serviceId: number,
  companyId: number,
): Promise<string | null> => {
  const serviceRow = await db.query.service.findFirst({
    where: and(eq(service.id, serviceId), eq(service.company_id, companyId)),
    columns: { name: true },
  });
  return serviceRow?.name?.trim() || null;
};

export async function getTicketServices(
  ticketId: string,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: ServiceTicket[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await assertTicketAccess(ticketIdBigInt(ticketId), 'tickets.read', companyId);
    const ticketServicesRows = await db.query.servicesTickets.findMany({
      where: and(
        eq(servicesTickets.ticket_id, ticketIdBigInt(ticketId)),
        isNull(servicesTickets.deleted_at),
      ),
      with: {
        service: true,
      },
    });

    return { success: true, data: ticketServicesRows as ServiceTicket[] };
  } catch (error) {
    return handleCodedServerActionError('ticket-services.list', 'TS001', error);
  }
}

export async function createServiceTicket(
  ticketId: string,
  data: CreateServiceTicketData,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: ServiceTicket;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const validated = createServiceTicketSchema.parse(data);
    const ticketIdValue = ticketIdBigInt(ticketId);
    const { companyId: effectiveCompanyId, context, total, paid } =
      await assertTicketAccess(ticketIdValue, 'tickets.write', companyId);
    assertTicketNotFullyPaid(total, paid);
    const serviceRow = await assertServiceAvailable(
      validated.service_id,
      effectiveCompanyId,
    );
    const values = {
      ticket_id: ticketIdValue,
      service_id: validated.service_id,
      quantity: validated.quantity,
      price: validated.price,
    };

    const serviceTicket = await db.transaction(async (tx) => {
      let createdRow: (typeof servicesTickets.$inferSelect) | undefined;
      try {
        [createdRow] = await tx.insert(servicesTickets).values(values).returning();
      } catch (error) {
        if (!isServicesTicketsPrimaryKeyConflict(error)) {
          throw error;
        }

        await syncServicesTicketsIdSequence();
        [createdRow] = await tx.insert(servicesTickets).values(values).returning();
      }

      if (!createdRow) {
        return undefined;
      }

      const syncedTotal = await syncTicketTotal(tx, ticketIdValue);
      await recordTicketAudit(tx, context, ticketIdValue, effectiveCompanyId, 'updated', {
        serviceLine: 'created',
        line: createdRow,
        serviceName: serviceRow.name,
        syncedTotal,
      });
      return createdRow;
    });

    if (!serviceTicket) {
      return buildActionError('TS002');
    }

    const full = await db.query.servicesTickets.findFirst({
      where: and(
        eq(servicesTickets.id, serviceTicket.id),
        isNull(servicesTickets.deleted_at),
      ),
      with: { service: true },
    });

    revalidatePath(`/tickets/${ticketId}/services`);
    invalidateCompanyCache(effectiveCompanyId, 'dashboard');
    return { success: true, data: full as ServiceTicket };
  } catch (error) {
    if (error instanceof TicketAlreadyPaidError) {
      return buildActionError('TC010', undefined, 'validation');
    }
    if (error instanceof ZodError) {
      return buildActionError('TS006', error, 'validation');
    }
    return handleCodedServerActionError('ticket-services.create', 'TS002', error);
  }
}

export async function updateServiceTicket(
  ticketId: string,
  serviceTicketId: number,
  data: UpdateServiceTicketData,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: ServiceTicket;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const validated = serviceLineMoneySchema.parse(data);
    const ticketIdValue = ticketIdBigInt(ticketId);
    const { companyId: effectiveCompanyId, context, total, paid } =
      await assertTicketAccess(ticketIdValue, 'tickets.write', companyId);
    assertTicketNotFullyPaid(total, paid);
    const runUpdate = async () =>
      db.transaction(async (tx) => {
        const [updatedRow] = await tx
          .update(servicesTickets)
          .set({
            quantity: validated.quantity,
            price: validated.price,
            updated_at: new Date(),
          })
          .where(
            and(
              eq(servicesTickets.id, serviceTicketId),
              eq(servicesTickets.ticket_id, ticketIdValue),
              isNull(servicesTickets.deleted_at),
            ),
          )
          .returning();

        if (!updatedRow) {
          return undefined;
        }

        const syncedTotal = await syncTicketTotal(tx, ticketIdValue);
        const serviceName = await resolveServiceNameById(
          updatedRow.service_id,
          effectiveCompanyId,
        );
        await recordTicketAudit(tx, context, ticketIdValue, effectiveCompanyId, 'updated', {
          serviceLine: 'updated',
          line: updatedRow,
          serviceName: serviceName ?? undefined,
          syncedTotal,
        });
        return updatedRow;
      });

    let updated: (typeof servicesTickets.$inferSelect) | undefined;
    try {
      updated = await runUpdate();
    } catch (error) {
      if (!isTransientNetworkError(error)) {
        throw error;
      }

      await sleep(200);
      updated = await runUpdate();
    }

    if (!updated) {
      return buildActionError('TS003');
    }

    const full = await db.query.servicesTickets.findFirst({
      where: and(
        eq(servicesTickets.id, updated.id),
        isNull(servicesTickets.deleted_at),
      ),
      with: { service: true },
    });

    revalidatePath(`/tickets/${ticketId}/services`);
    invalidateCompanyCache(effectiveCompanyId, 'dashboard');
    return { success: true, data: full as ServiceTicket };
  } catch (error) {
    if (error instanceof TicketAlreadyPaidError) {
      return buildActionError('TC010', undefined, 'validation');
    }
    if (error instanceof ZodError) {
      return buildActionError('TS006', error, 'validation');
    }
    return handleCodedServerActionError('ticket-services.update', 'TS003', error);
  }
}

export async function deleteServiceTicket(
  ticketId: string,
  serviceTicketId: number,
  companyId?: number | null,
): Promise<{ success: boolean; error?: string; errorType?: ActionErrorType }> {
  try {
    const ticketIdValue = ticketIdBigInt(ticketId);
    const { companyId: effectiveCompanyId, context, total, paid } =
      await assertTicketAccess(ticketIdValue, 'tickets.write', companyId);
    assertTicketNotFullyPaid(total, paid);
    await db.transaction(async (tx) => {
      const [deletedRow] = await tx
        .update(servicesTickets)
        .set({ deleted_at: new Date(), updated_at: new Date() })
        .where(
          and(
            eq(servicesTickets.id, serviceTicketId),
            eq(servicesTickets.ticket_id, ticketIdValue),
            isNull(servicesTickets.deleted_at),
          ),
        )
        .returning();
      const syncedTotal = await syncTicketTotal(tx, ticketIdValue);
      if (deletedRow) {
        const serviceName = await resolveServiceNameById(
          deletedRow.service_id,
          effectiveCompanyId,
        );
        await recordTicketAudit(tx, context, ticketIdValue, effectiveCompanyId, 'updated', {
          serviceLine: 'deleted',
          line: deletedRow,
          serviceName: serviceName ?? undefined,
          syncedTotal,
        });
      }
    });

    revalidatePath(`/tickets/${ticketId}/services`);
    invalidateCompanyCache(effectiveCompanyId, 'dashboard');
    return { success: true };
  } catch (error) {
    if (error instanceof TicketAlreadyPaidError) {
      return buildActionError('TC010', undefined, 'validation');
    }
    return handleCodedServerActionError('ticket-services.delete', 'TS004', error);
  }
}
