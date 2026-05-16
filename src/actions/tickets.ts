'use server';

import { revalidatePath } from 'next/cache';
import { desc, eq, and, isNull, sql, inArray } from 'drizzle-orm';
import {
  service,
  servicesTickets,
  ticket,
  ticketAuditEvent,
  ticketPayment,
  type Company,
  type Service,
  type ServicesTicketsRow,
  type TicketPaymentRow,
  type TicketRow,
} from '@/db/schema';
import { db } from '@/lib/db';
import {
  AuthorizationError,
  classifyServerErrorType,
  type ActionErrorType,
} from '@/lib/errors';
import { calculateTicketTotal } from '@/lib/ticket-financials';
import {
  AMOUNT_TOLERANCE,
  getTicketBalanceDue,
} from '@/lib/ticket-payment-status';
import { requireActionPermission } from '@/lib/security';
import type { ActionAuthContext } from '@/lib/authz-context';
import { z } from 'zod';

const ticketSchema = z.object({
  client_id: z.number().optional(),
  client_name: z.string().min(1, 'Client name is required'),
  client_tel: z.string().min(1, 'Client phone is required'),
  email: z
    .string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
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
  company: Company | null;
  services_tickets: Array<
    ServicesTicketsRow & {
      service: Service | null;
    }
  >;
  /** Present when loaded with `with`; lista suele omitirla. */
  ticket_payments?: TicketPaymentRow[];
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

const assertTicketWritable = async (
  ticketId: bigint,
  companyId: number,
): Promise<void> => {
  const ticketRow = await db.query.ticket.findFirst({
    where: and(eq(ticket.id, ticketId), isNull(ticket.deleted_at)),
  });

  if (!ticketRow) {
    throw new AuthorizationError('Ticket not found');
  }

  if (ticketRow.company_id !== companyId) {
    throw new AuthorizationError('Access denied to this ticket');
  }
};

const toAuditJson = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toAuditJson);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toAuditJson(entry)]),
    );
  }

  return value;
};

type TicketAuditWriter = Pick<typeof db, 'insert'>;

const recordTicketAudit = async (
  tx: TicketAuditWriter,
  context: ActionAuthContext,
  ticketId: bigint,
  companyId: number | null,
  eventType: string,
  payload: Record<string, unknown>,
) => {
  await tx.insert(ticketAuditEvent).values({
    ticket_id: ticketId,
    company_id: companyId,
    actor_user_id: BigInt(context.userId),
    event_type: eventType,
    payload: toAuditJson(payload) as Record<string, unknown>,
  });
};

const assertServicesBelongToCompany = async (
  serviceIds: number[],
  companyId: number,
) => {
  const uniqueServiceIds = Array.from(new Set(serviceIds));
  if (uniqueServiceIds.length === 0) {
    return;
  }

  const rows = await db
    .select({ id: service.id })
    .from(service)
    .where(
      and(
        inArray(service.id, uniqueServiceIds),
        eq(service.company_id, companyId),
        isNull(service.deleted_at),
      ),
    );

  if (rows.length !== uniqueServiceIds.length) {
    throw new AuthorizationError('One or more services are unavailable');
  }
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
    const validatedData = ticketSchema.parse(data);
    const { context, companyId: effectiveCompanyId } = await requireActionPermission(
      'tickets.write',
      validatedData.company_id,
    );

    const values = {
      client_id: validatedData.client_id,
      client_name: validatedData.client_name,
      client_tel: validatedData.client_tel,
      email: validatedData.email,
      document: validatedData.document,
      ticket_date: validatedData.ticket_date,
      company_id: effectiveCompanyId,
      userId: BigInt(context.userId),
    };

    let created: TicketRow | undefined;
    try {
      created = await db.transaction(async (tx) => {
        const [row] = await tx.insert(ticket).values(values).returning();
        await recordTicketAudit(tx, context, row.id, row.company_id, 'created', {
          ticket: row,
        });
        return row;
      });
    } catch (error) {
      if (!isTicketPrimaryKeyConflict(error)) {
        throw error;
      }

      await syncTicketIdSequence();
      created = await db.transaction(async (tx) => {
        const [row] = await tx.insert(ticket).values(values).returning();
        await recordTicketAudit(tx, context, row.id, row.company_id, 'created', {
          ticket: row,
        });
        return row;
      });
    }

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
    const { companyId: effectiveCompanyId } = await requireActionPermission(
      'tickets.read',
      companyId ?? undefined,
    );
    const tickets = await db.query.ticket.findMany({
      where: and(
        eq(ticket.company_id, effectiveCompanyId),
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

/** Lista ligera sin relaciones (uso en tabla / dashboard). */
export async function getTicketsList(
  companyId: number | null,
): Promise<{
  success: boolean;
  data?: Ticket[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireActionPermission(
      'tickets.read',
      companyId ?? undefined,
    );
    const tickets = await db.query.ticket.findMany({
      where: and(
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
      ),
      orderBy: [desc(ticket.created_at)],
    });

    return { success: true, data: tickets as Ticket[] };
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
    const { companyId } = await requireActionPermission('tickets.read');
    const ticketRow = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, BigInt(id)),
        eq(ticket.company_id, companyId),
        isNull(ticket.deleted_at),
      ),
      with: {
        company: true,
        services_tickets: {
          with: {
            service: true,
          },
        },
        ticket_payments: {
          orderBy: (tp, { asc }) => [asc(tp.created_at)],
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
    const { context, companyId: effectiveCompanyId } = await requireActionPermission(
      'tickets.write',
      data.company_id ?? undefined,
    );
    const ticketId = BigInt(id);
    await assertTicketWritable(ticketId, effectiveCompanyId);

    const servicesToSync = Array.isArray(data.services) ? data.services : null;
    const hasServicesUpdate = servicesToSync !== null;
    const totalFromServices = hasServicesUpdate
      ? calculateTicketTotal(servicesToSync)
      : undefined;

    if (hasServicesUpdate) {
      await assertServicesBelongToCompany(
        servicesToSync.map((row) => row.service_id),
        effectiveCompanyId,
      );
    }

    const prior = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, ticketId),
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
      ),
      with: {
        services_tickets: {
          where: isNull(servicesTickets.deleted_at),
        },
      },
    });

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
        .where(
          and(
            eq(ticket.id, ticketId),
            eq(ticket.company_id, effectiveCompanyId),
            isNull(ticket.deleted_at),
          ),
        )
        .returning();

      if (row) {
        await recordTicketAudit(
          tx,
          context,
          ticketId,
          effectiveCompanyId,
          'updated',
          {
            before: prior,
            after: row,
            servicesChanged: hasServicesUpdate,
            services: servicesToSync ?? undefined,
          },
        );
      }

      return row;
    });

    const full = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, ticketId),
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
      ),
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
    const { context, companyId: effectiveCompanyId } =
      await requireActionPermission('tickets.write');
    const ticketId = BigInt(id);
    await assertTicketWritable(ticketId, effectiveCompanyId);
    const prior = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, ticketId),
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
      ),
    });
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(ticket)
        .set({ deleted_at: new Date() })
        .where(
          and(
            eq(ticket.id, ticketId),
            eq(ticket.company_id, effectiveCompanyId),
            isNull(ticket.deleted_at),
          ),
        )
        .returning();

      if (row) {
        await recordTicketAudit(
          tx,
          context,
          ticketId,
          effectiveCompanyId,
          'deleted',
          { before: prior, after: row },
        );
      }
    });

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
    const { context, companyId: effectiveCompanyId } =
      await requireActionPermission('tickets.write');
    const ticketId = BigInt(id);
    await assertTicketWritable(ticketId, effectiveCompanyId);

    const prior = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, ticketId),
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
      ),
    });
    if (prior?.finished) {
      return {
        success: false,
        error: 'Este ticket ya está finalizado',
        errorType: 'validation',
      };
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(ticket)
        .set({
          finished: true,
          total: total,
          paid: paid,
        })
        .where(
          and(
            eq(ticket.id, ticketId),
            eq(ticket.company_id, effectiveCompanyId),
            isNull(ticket.deleted_at),
          ),
        )
        .returning();

      if (row && paid > AMOUNT_TOLERANCE) {
        await tx.insert(ticketPayment).values({
          ticket_id: ticketId,
          amount: paid,
          company_id: row.company_id,
        });
      }

      if (row) {
        await recordTicketAudit(
          tx,
          context,
          ticketId,
          effectiveCompanyId,
          'finished',
          {
            before: prior,
            after: row,
            initialPayment: paid > AMOUNT_TOLERANCE ? paid : 0,
          },
        );
      }

      return row;
    });

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

export async function applyTicketPayment(
  id: number,
  additionalPaid: number,
): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId: effectiveCompanyId } =
      await requireActionPermission('tickets.write');
    const ticketId = BigInt(id);
    await assertTicketWritable(ticketId, effectiveCompanyId);

    if (!Number.isFinite(additionalPaid) || additionalPaid <= 0) {
      return {
        success: false,
        error: 'El monto debe ser mayor a cero',
        errorType: 'validation',
      };
    }

    const ticketRow = await db.query.ticket.findFirst({
      where: and(eq(ticket.id, ticketId), isNull(ticket.deleted_at)),
    });

    if (!ticketRow) {
      return {
        success: false,
        error: 'Ticket no encontrado',
        errorType: 'validation',
      };
    }

    if (!ticketRow.finished) {
      return {
        success: false,
        error:
          'Solo se pueden registrar cobros adicionales en tickets finalizados',
        errorType: 'validation',
      };
    }

    const totalAmount = ticketRow.total ?? 0;
    const currentPaid = ticketRow.paid ?? 0;
    const balanceDue = getTicketBalanceDue(ticketRow.total, ticketRow.paid);

    if (balanceDue <= 0) {
      return {
        success: false,
        error: 'Este ticket ya no tiene saldo pendiente',
        errorType: 'validation',
      };
    }

    const newPaid = Math.min(totalAmount, currentPaid + additionalPaid);
    const appliedAmount = newPaid - currentPaid;

    if (appliedAmount <= AMOUNT_TOLERANCE) {
      return {
        success: false,
        error: 'No hay saldo aplicable con ese monto',
        errorType: 'validation',
      };
    }

    const updated = await db.transaction(async (tx) => {
      await tx.insert(ticketPayment).values({
        ticket_id: ticketId,
        amount: appliedAmount,
        company_id: ticketRow.company_id,
      });

      const [row] = await tx
        .update(ticket)
        .set({ paid: newPaid })
        .where(
          and(
            eq(ticket.id, ticketId),
            eq(ticket.company_id, effectiveCompanyId),
            isNull(ticket.deleted_at),
          ),
        )
        .returning();

      if (row) {
        await recordTicketAudit(
          tx,
          context,
          ticketId,
          effectiveCompanyId,
          'payment_collected',
          {
            before: ticketRow,
            after: row,
            payment: {
              requestedAmount: additionalPaid,
              appliedAmount,
            },
          },
        );
      }

      return row;
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/tickets');
    revalidatePath(`/dashboard/tickets/${id}`);

    return { success: true, data: updated };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: 'Error al registrar el cobro',
      errorType: classifyServerErrorType(e),
    };
  }
}
