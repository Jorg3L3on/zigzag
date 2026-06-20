'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { service, servicesTickets, ticket } from '@/db/schema';
import type { Service } from '@/db/schema';
import { db } from '@/lib/db';
import {
  AuthorizationError,
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { requireActionPermission } from '@/lib/security';
import { syncTicketTotal } from '@/lib/ticket-financials';
import { revalidatePath } from 'next/cache';

export interface ServiceTicket {
  id: number;
  service_id: number;
  quantity: number;
  price: number;
  service: Service;
}

export interface CreateServiceTicketData {
  service_id: number;
  quantity: number;
  price: number;
}

export interface UpdateServiceTicketData {
  quantity: number;
  price: number;
}

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
): Promise<number> => {
  const { companyId: effectiveCompanyId } =
    await requireActionPermission(permissionKey);

  const ticketRow = await db.query.ticket.findFirst({
    where: and(eq(ticket.id, ticketId), isNull(ticket.deleted_at)),
  });

  if (!ticketRow) {
    throw new AuthorizationError('Ticket not found');
  }

  if (ticketRow.company_id !== effectiveCompanyId) {
    throw new AuthorizationError('Access denied to this ticket');
  }

  return effectiveCompanyId;
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
};

export async function getTicketServices(
  ticketId: string,
): Promise<{
  success: boolean;
  data?: ServiceTicket[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await assertTicketAccess(ticketIdBigInt(ticketId), 'tickets.read');
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
): Promise<{
  success: boolean;
  data?: ServiceTicket;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const companyId = await assertTicketAccess(
      ticketIdBigInt(ticketId),
      'tickets.write',
    );
    await assertServiceAvailable(data.service_id, companyId);
    const values = {
      ticket_id: ticketIdBigInt(ticketId),
      service_id: data.service_id,
      quantity: data.quantity,
      price: data.price,
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

      await syncTicketTotal(tx, ticketIdBigInt(ticketId));
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
    return { success: true, data: full as ServiceTicket };
  } catch (error) {
    return handleCodedServerActionError('ticket-services.create', 'TS002', error);
  }
}

export async function updateServiceTicket(
  ticketId: string,
  serviceTicketId: number,
  data: UpdateServiceTicketData,
): Promise<{
  success: boolean;
  data?: ServiceTicket;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await assertTicketAccess(ticketIdBigInt(ticketId), 'tickets.write');
    const ticketIdValue = ticketIdBigInt(ticketId);
    const runUpdate = async () =>
      db.transaction(async (tx) => {
        const [updatedRow] = await tx
          .update(servicesTickets)
          .set({
            quantity: data.quantity,
            price: data.price,
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

        await syncTicketTotal(tx, ticketIdValue);
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
    return { success: true, data: full as ServiceTicket };
  } catch (error) {
    return handleCodedServerActionError('ticket-services.update', 'TS003', error);
  }
}

export async function deleteServiceTicket(
  ticketId: string,
  serviceTicketId: number,
): Promise<{ success: boolean; error?: string; errorType?: ActionErrorType }> {
  try {
    await assertTicketAccess(ticketIdBigInt(ticketId), 'tickets.write');
    await db.transaction(async (tx) => {
      await tx
        .update(servicesTickets)
        .set({ deleted_at: new Date(), updated_at: new Date() })
        .where(
          and(
            eq(servicesTickets.id, serviceTicketId),
            eq(servicesTickets.ticket_id, ticketIdBigInt(ticketId)),
            isNull(servicesTickets.deleted_at),
          ),
        );
      await syncTicketTotal(tx, ticketIdBigInt(ticketId));
    });

    revalidatePath(`/tickets/${ticketId}/services`);
    return { success: true };
  } catch (error) {
    return handleCodedServerActionError('ticket-services.delete', 'TS004', error);
  }
}
