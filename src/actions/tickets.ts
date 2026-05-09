'use server';

import { desc, eq, and, isNull, sql } from 'drizzle-orm';
import {
  servicesTickets,
  ticket,
  type Service,
  type ServicesTicketsRow,
  type TicketRow,
} from '@/db/schema';
import { db } from '@/lib/db';
import { classifyServerErrorType, type ActionErrorType } from '@/lib/errors';
import { z } from 'zod';

const ticketSchema = z.object({
  client_id: z.number().optional(),
  client_name: z.string().min(1, 'Client name is required'),
  client_tel: z.string().min(1, 'Client phone is required'),
  email: z.string().email('Invalid email address').optional(),
  document: z.string().optional(),
  ticket_date: z.date(),
  services: z.array(
    z.object({
      service_id: z.number(),
      quantity: z.number().min(1),
      price: z.number().min(0),
    }),
  ),
  company_id: z.number(),
});

export type CreateTicketInput = z.infer<typeof ticketSchema>;

export type Ticket = {
  id: bigint;
  client_id: number | null;
  client_name: string | null;
  client_tel: string | null;
  email: string | null;
  document: string | null;
  ticket_date: Date | null;
  total: number | null;
  paid: number | null;
  finished: boolean;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  company_id: number | null;
};

/** Row from `getTicketById` with relations (matches Drizzle `with` query). */
export type TicketDetailData = TicketRow & {
  services_tickets: Array<
    ServicesTicketsRow & {
      service: Service | null;
    }
  >;
};

export type GetTicketByIdResult =
  | { success: true; data: TicketDetailData }
  | { success: false; error: string; errorType?: ActionErrorType };

type PgError = {
  code?: string;
  constraint?: string;
};

const isTicketPrimaryKeyConflict = (error: unknown): boolean => {
  const dbError = (error as { cause?: PgError })?.cause;
  return (
    dbError?.code === '23505' &&
    (dbError?.constraint === 'Ticket_pkey' || dbError?.constraint === 'ticket_pkey')
  );
};

const syncTicketIdSequence = async (): Promise<void> => {
  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('"Ticket"', 'id'),
      COALESCE((SELECT MAX("id") FROM "Ticket"), 0) + 1,
      false
    );
  `);
};

export async function createTicket(
  data: CreateTicketInput,
): Promise<{
  success: boolean;
  data?: Ticket;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    console.log('Creating ticket with data:', data);
    const validatedData = ticketSchema.parse(data);
    console.log('Validated data:', validatedData);

    const values = {
      client_id: validatedData.client_id,
      client_name: validatedData.client_name,
      client_tel: validatedData.client_tel,
      email: validatedData.email,
      document: validatedData.document,
      ticket_date: validatedData.ticket_date,
      company_id: validatedData.company_id,
    };

    let created: unknown;
    try {
      [created] = await db.insert(ticket).values(values).returning();
    } catch (error) {
      if (!isTicketPrimaryKeyConflict(error)) {
        throw error;
      }

      await syncTicketIdSequence();
      [created] = await db.insert(ticket).values(values).returning();
    }

    console.log('Created ticket:', created);
    return {
      success: true,
      data: created as unknown as Ticket,
    };
  } catch (error) {
    console.error('Error creating ticket:', error);
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.issues);
      return {
        success: false,
        error: 'Invalid ticket data',
        errorType: 'validation',
      };
    }
    return {
      success: false,
      error: 'Error creating ticket',
      errorType: classifyServerErrorType(error),
    };
  }
}

export async function getTickets(
  companyId: number | null,
): Promise<{
  success: boolean;
  data?: TicketDetailData[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const tickets = await db.query.ticket.findMany({
      where: and(
        companyId === null
          ? isNull(ticket.company_id)
          : eq(ticket.company_id, companyId),
        isNull(ticket.deleted_at),
      ),
      with: {
        services_tickets: {
          with: {
            service: true,
          },
        },
      },
      orderBy: [desc(ticket.created_at)],
    });

    return { success: true, data: tickets as TicketDetailData[] };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: 'Error al obtener los tickets',
      errorType: classifyServerErrorType(e),
    };
  }
}

export async function getTicketById(id: number): Promise<GetTicketByIdResult> {
  try {
    const ticketRow = await db.query.ticket.findFirst({
      where: eq(ticket.id, BigInt(id)),
      with: {
        services_tickets: {
          with: {
            service: true,
          },
        },
      },
    });

    if (!ticketRow) {
      return { success: false, error: 'Ticket no encontrado', errorType: 'validation' };
    }

    return { success: true, data: ticketRow as TicketDetailData };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: 'Error al obtener el ticket',
      errorType: classifyServerErrorType(e),
    };
  }
}

export async function updateTicket(
  id: number,
  data: Partial<CreateTicketInput>,
): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const ticketId = BigInt(id);

    const servicesToSync = Array.isArray(data.services) ? data.services : null;
    const hasServicesUpdate = servicesToSync !== null;
    const totalFromServices = hasServicesUpdate
      ? servicesToSync.reduce(
          (acc: number, service) => acc + service.price * service.quantity,
          0,
        )
      : undefined;

    const updated = await db.transaction(async (tx) => {
      if (hasServicesUpdate) {
        await tx
          .delete(servicesTickets)
          .where(eq(servicesTickets.ticket_id, ticketId));

        if (servicesToSync.length) {
          await tx.insert(servicesTickets).values(
            servicesToSync.map((service) => ({
              service_id: service.service_id,
              ticket_id: ticketId,
              quantity: service.quantity,
              price: service.price,
            })),
          );
        }
      }

      const ticketUpdateData: {
        client_name?: string;
        client_tel?: string;
        email?: string;
        document?: string;
        ticket_date?: Date;
        total?: number;
      } = {
        client_name: data.client_name,
        client_tel: data.client_tel,
        email: data.email,
        document: data.document,
        ticket_date: data.ticket_date,
      };

      if (totalFromServices !== undefined) {
        ticketUpdateData.total = totalFromServices;
      }

      const [row] = await tx
        .update(ticket)
        .set(ticketUpdateData)
        .where(eq(ticket.id, ticketId))
        .returning();

      return row;
    });

    const full = await db.query.ticket.findFirst({
      where: eq(ticket.id, ticketId),
      with: {
        services_tickets: {
          with: {
            service: true,
          },
        },
      },
    });

    return { success: true, data: full ?? updated };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: 'Error al actualizar el ticket',
      errorType: classifyServerErrorType(e),
    };
  }
}

export async function deleteTicket(id: number): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await db
      .update(ticket)
      .set({ deleted_at: new Date() })
      .where(eq(ticket.id, BigInt(id)));

    return { success: true };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: 'Error al eliminar el ticket',
      errorType: classifyServerErrorType(e),
    };
  }
}

export async function finishTicket(
  id: number,
  total: number,
  paid: number,
): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const [updated] = await db
      .update(ticket)
      .set({
        finished: true,
        document: null,
        total: total,
        paid: paid,
      })
      .where(eq(ticket.id, BigInt(id)))
      .returning();

    return { success: true, data: updated };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: 'Error al finalizar el ticket',
      errorType: classifyServerErrorType(e),
    };
  }
}
