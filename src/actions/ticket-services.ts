'use server';

import { and, eq, sql } from 'drizzle-orm';
import { servicesTickets, ticket } from '@/db/schema';
import type { Service } from '@/db/schema';
import { db } from '@/lib/db';
import {
  AuthorizationError,
  classifyServerErrorType,
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
): Promise<void> => {
  const { companyId: effectiveCompanyId } =
    await requireActionPermission(permissionKey);

  const ticketRow = await db.query.ticket.findFirst({
    where: eq(ticket.id, ticketId),
  });

  if (!ticketRow) {
    throw new AuthorizationError('Ticket not found');
  }

  if (ticketRow.company_id !== effectiveCompanyId) {
    throw new AuthorizationError('Access denied to this ticket');
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
      where: eq(servicesTickets.ticket_id, ticketIdBigInt(ticketId)),
      with: {
        service: true,
      },
    });

    return { success: true, data: ticketServicesRows as ServiceTicket[] };
  } catch (error) {
    console.error('Error fetching ticket services:', error);
    return {
      success: false,
      error: 'Error al cargar los servicios del ticket',
      errorType: classifyServerErrorType(error),
    };
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
    await assertTicketAccess(ticketIdBigInt(ticketId), 'tickets.write');
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
      return {
        success: false,
        error: 'No se pudo crear el servicio del ticket',
        errorType: 'server',
      };
    }

    const full = await db.query.servicesTickets.findFirst({
      where: eq(servicesTickets.id, serviceTicket.id),
      with: { service: true },
    });

    revalidatePath(`/dashboard/tickets/${ticketId}/services`);
    return { success: true, data: full as ServiceTicket };
  } catch (error) {
    console.error('Error creating service ticket:', error);
    return {
      success: false,
      error: 'Error al agregar el servicio al ticket',
      errorType: classifyServerErrorType(error),
    };
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
          })
          .where(
            and(
              eq(servicesTickets.id, serviceTicketId),
              eq(servicesTickets.ticket_id, ticketIdValue),
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
      return {
        success: false,
        error: 'No se pudo actualizar el servicio del ticket',
        errorType: 'server',
      };
    }

    const full = await db.query.servicesTickets.findFirst({
      where: eq(servicesTickets.id, updated.id),
      with: { service: true },
    });

    revalidatePath(`/dashboard/tickets/${ticketId}/services`);
    return { success: true, data: full as ServiceTicket };
  } catch (error) {
    console.error('Error updating service ticket:', error);
    const errorType = isTransientNetworkError(error)
      ? 'network'
      : classifyServerErrorType(error);
    return {
      success: false,
      error: 'Error al actualizar el servicio del ticket',
      errorType,
    };
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
        .delete(servicesTickets)
        .where(
          and(
            eq(servicesTickets.id, serviceTicketId),
            eq(servicesTickets.ticket_id, ticketIdBigInt(ticketId)),
          ),
        );
      await syncTicketTotal(tx, ticketIdBigInt(ticketId));
    });

    revalidatePath(`/dashboard/tickets/${ticketId}/services`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting service ticket:', error);
    return {
      success: false,
      error: 'Error al eliminar el servicio del ticket',
      errorType: classifyServerErrorType(error),
    };
  }
}
