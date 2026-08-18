'use server';

import { revalidatePath } from 'next/cache';
import { desc, eq, and, isNull, sql, inArray, count, ilike, or } from 'drizzle-orm';
import {
  client,
  service,
  servicesTickets,
  ticket,
  ticketAuditEvent,
  ticketPayment,
  type Client,
  type Company,
  type Service,
  type ServicesTicketsRow,
  type TicketPaymentRow,
  type TicketRow,
  type User,
} from '@/db/schema';
import { redactAuditDisplayValue } from '@/lib/audit-display';
import { db } from '@/lib/db';
import { recordTicketAudit } from '@/lib/ticket-audit';
import { invalidateCompanyCache } from '@/lib/cache';
import { acquireAdvisoryLock, ADVISORY_LOCK_NAMESPACE } from '@/lib/db-locks';
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  buildActionError,
  handleCodedServerActionError,
  handleServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { calculateTicketTotal, syncTicketTotal } from '@/lib/ticket-financials';
import { addMoney, roundMoney, subtractMoney } from '@/lib/money';
import { TICKET_CSV_HEADERS } from '@/lib/csv-schemas';
import {
  AMOUNT_TOLERANCE,
  getTicketBalanceDue,
  getTicketPaymentStatus,
  isTicketFullyPaid,
  TICKET_PAYMENT_STATUS_LABEL,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { format as formatDate } from 'date-fns';
import {
  assertCompanyProductionReady,
  CompanyProductionBlockedError,
} from '@/lib/company-production-guard';
import { requireTicketRead, requireTicketWrite, requireTenantTicketRead } from '@/lib/tickets-rbac-server';
import type { ActionAuthContext } from '@/lib/authz-context';
import { isWorkTicket } from '@/lib/ticket-document-kind';
import { z } from 'zod';

const ticketServiceLineSchema = z.object({
  service_id: z.number(),
  quantity: z.number().finite().min(1),
  price: z.number().finite().min(0),
});

/** Shell fields only — service lines attach via ticket-services actions (TCI-06). */
const ticketSchema = z.object({
  client_id: z.number().optional(),
  client_name: z.string().min(1, 'El nombre del cliente es obligatorio').max(100),
  client_tel: z.string().min(1, 'El teléfono del cliente es obligatorio').max(20),
  email: z
    .string()
    .email('El correo electrónico no es válido')
    .max(40)
    .optional()
    .or(z.literal('')),
  document: z.string().max(100).optional(),
  ticket_date: z.date(),
  company_id: z.number(),
});

export type CreateTicketInput = z.infer<typeof ticketSchema> & {
  /** Optional replace-all lines on update only; ignored by createTicket. */
  services?: Array<z.infer<typeof ticketServiceLineSchema>>;
};

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
  client?: Client | null;
  /** Creator at ticket create time (not an assignee workflow). */
  User?: Pick<User, 'id' | 'name' | 'email'> | null;
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
  | {
      success: false;
      error: string;
      errorCode?: string;
      errorTitle?: string;
      errorType?: ActionErrorType;
    };

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
): Promise<TicketRow> => {
  const ticketRow = await db.query.ticket.findFirst({
    where: and(eq(ticket.id, ticketId), isNull(ticket.deleted_at)),
  });

  if (!ticketRow) {
    throw new AuthorizationError('Ticket not found');
  }

  if (ticketRow.company_id !== companyId) {
    throw new AuthorizationError('Access denied to this ticket');
  }

  return ticketRow;
};

class PresupuestoMutationBlockedError extends Error {
  constructor() {
    super('Presupuesto mutation blocked');
    this.name = 'PresupuestoMutationBlockedError';
  }
}

const assertIsWorkTicketRow = (ticketRow: {
  document_kind?: string | null;
}): void => {
  if (!isWorkTicket(ticketRow.document_kind)) {
    throw new PresupuestoMutationBlockedError();
  }
};

class FinishPaidExceedsTotalError extends Error {
  constructor() {
    super('Paid amount exceeds ticket total');
    this.name = 'FinishPaidExceedsTotalError';
  }
}

class EmptyTicketFinishError extends Error {
  constructor() {
    super('Cannot finish a ticket with no active service lines');
    this.name = 'EmptyTicketFinishError';
  }
}

class TicketAlreadyFinishedError extends Error {
  constructor() {
    super('Ticket already finished');
    this.name = 'TicketAlreadyFinishedError';
  }
}

class TicketAlreadyPaidError extends Error {
  constructor() {
    super('Ticket already fully paid');
    this.name = 'TicketAlreadyPaidError';
  }
}

const assertTicketNotFullyPaid = async (
  ticketId: bigint,
  companyId: number,
): Promise<void> => {
  const ticketRow = await db.query.ticket.findFirst({
    where: and(
      eq(ticket.id, ticketId),
      eq(ticket.company_id, companyId),
      isNull(ticket.deleted_at),
    ),
    columns: {
      total: true,
      paid: true,
    },
  });

  if (!ticketRow) {
    throw new AuthorizationError('Ticket not found');
  }

  if (isTicketFullyPaid(ticketRow.total, ticketRow.paid)) {
    throw new TicketAlreadyPaidError();
  }
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

/** Active client must belong to the ticket company (TCI-01). */
const assertClientBelongsToCompany = async (
  clientId: number | undefined,
  companyId: number,
): Promise<void> => {
  if (clientId == null) {
    return;
  }

  const clientRow = await db.query.client.findFirst({
    where: and(
      eq(client.id, clientId),
      eq(client.company_id, companyId),
      isNull(client.deleted_at),
    ),
    columns: { id: true },
  });

  if (!clientRow) {
    throw new AuthorizationError('Client not found for this company');
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
    const { context, companyId: effectiveCompanyId } = await requireTicketWrite(
      validatedData.company_id,
    );

    await assertCompanyProductionReady(effectiveCompanyId);
    await assertClientBelongsToCompany(
      validatedData.client_id,
      effectiveCompanyId,
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
      document_kind: 'ticket' as const,
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

    invalidateCompanyCache(effectiveCompanyId, 'dashboard');

    return {
      success: true,
      data: created as unknown as Ticket,
    };
  } catch (error) {
    if (error instanceof CompanyProductionBlockedError) {
      return handleServerActionError(error);
    }
    if (error instanceof z.ZodError) {
      return handleCodedServerActionError('tickets.create.validation', 'TC009', error);
    }
    return handleCodedServerActionError('tickets.create', 'TC001', error);
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
    const { companyId: effectiveCompanyId } = await requireTicketRead(
      companyId ?? undefined,
    );
    const tickets = await db.query.ticket.findMany({
      where: and(
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
        eq(ticket.document_kind, 'ticket'),
      ),
      with: {
        services_tickets: {
          where: isNull(servicesTickets.deleted_at),
          with: {
            service: true,
          },
        },
      },
      orderBy: [desc(ticket.created_at)],
    });

    return { success: true, data: tickets as TicketDetailData[] };
  } catch (e) {
    return handleCodedServerActionError('tickets.list.with-relations', 'TC002', e);
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
    const { companyId: effectiveCompanyId } = await requireTicketRead(
      companyId ?? undefined,
    );
    const tickets = await db.query.ticket.findMany({
      where: and(
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
        eq(ticket.document_kind, 'ticket'),
      ),
      orderBy: [desc(ticket.created_at)],
    });

    return { success: true, data: tickets as Ticket[] };
  } catch (e) {
    return handleCodedServerActionError('tickets.list', 'TC002', e);
  }
}

export interface PaginatedTicketsData {
  items: TicketRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type TicketListPaymentFilter = TicketPaymentStatus | 'all';

export type TicketListFinishedFilter = 'all' | 'yes' | 'no';

const buildTicketPaymentStatusCondition = (
  status: TicketListPaymentFilter,
) => {
  if (status === 'all') {
    return undefined;
  }

  const paid = sql`COALESCE(${ticket.paid}, 0)`;
  const total = sql`COALESCE(${ticket.total}, 0)`;

  if (status === 'paid') {
    return sql`${total} > 0.01 AND ${paid} >= ${total} - 0.01`;
  }

  if (status === 'partial') {
    return sql`${total} > 0.01 AND ${paid} > 0.01 AND ${paid} < ${total} - 0.01`;
  }

  return sql`(${total} <= 0.01) OR (${paid} <= 0.01 AND NOT (${total} > 0.01 AND ${paid} >= ${total} - 0.01))`;
};

/**
 * Server-side paginated + searchable ticket list, scoped to the company. Keeps
 * large ticket tables responsive instead of loading every row client-side.
 */
export async function getTicketsPaginated(params: {
  companyId?: number | null;
  page?: number;
  pageSize?: number;
  search?: string;
  statusFilter?: TicketListPaymentFilter;
  finishedFilter?: TicketListFinishedFilter;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{
  success: boolean;
  data?: PaginatedTicketsData;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireTicketRead(
      params.companyId ?? undefined,
    );

    const page = Math.max(1, Math.floor(params.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 25)));
    const search = params.search?.trim();

    const searchCondition = search
      ? or(
          ilike(ticket.client_name, `%${search}%`),
          ilike(ticket.email, `%${search}%`),
          ilike(ticket.document, `%${search}%`),
          ilike(ticket.client_tel, `%${search}%`),
          sql`CAST(${ticket.id} AS TEXT) LIKE ${`%${search}%`}`,
        )
      : undefined;

    const paymentStatusCondition = buildTicketPaymentStatusCondition(
      params.statusFilter ?? 'all',
    );

    const finishedCondition =
      params.finishedFilter === 'yes'
        ? eq(ticket.finished, true)
        : params.finishedFilter === 'no'
          ? eq(ticket.finished, false)
          : undefined;

    const dateFromCondition = params.dateFrom
      ? sql`${ticket.ticket_date} >= ${params.dateFrom}::timestamptz`
      : undefined;
    const dateToCondition = params.dateTo
      ? sql`${ticket.ticket_date} <= ${params.dateTo}::timestamptz`
      : undefined;

    const whereCondition = and(
      eq(ticket.company_id, effectiveCompanyId),
      isNull(ticket.deleted_at),
      eq(ticket.document_kind, 'ticket'),
      ...(searchCondition ? [searchCondition] : []),
      ...(paymentStatusCondition ? [paymentStatusCondition] : []),
      ...(finishedCondition ? [finishedCondition] : []),
      ...(dateFromCondition ? [dateFromCondition] : []),
      ...(dateToCondition ? [dateToCondition] : []),
    );

    const [{ total }] = await db
      .select({ total: count() })
      .from(ticket)
      .where(whereCondition);

    const totalCount = Number(total ?? 0);
    const items = await db
      .select()
      .from(ticket)
      .where(whereCondition)
      .orderBy(desc(ticket.created_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      success: true,
      data: {
        items,
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      },
    };
  } catch (e) {
    return handleCodedServerActionError('tickets.paginated-list', 'TC002', e);
  }
}

export async function getTicketById(
  id: number,
  requestedCompanyId?: number | null,
): Promise<GetTicketByIdResult> {
  try {
    const { context, companyId } = await requireTicketRead(requestedCompanyId);
    const ticketRow = await db.query.ticket.findFirst({
      where:
        context.companyIsSystem && requestedCompanyId == null
          ? and(eq(ticket.id, BigInt(id)), isNull(ticket.deleted_at))
          : and(
              eq(ticket.id, BigInt(id)),
              eq(ticket.company_id, companyId),
              isNull(ticket.deleted_at),
            ),
      with: {
        company: true,
        client: true,
        User: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        services_tickets: {
          where: isNull(servicesTickets.deleted_at),
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
      return buildActionError('TC008');
    }

    return { success: true, data: ticketRow as TicketDetailData };
  } catch (e) {
    return handleCodedServerActionError('tickets.get', 'TC003', e);
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
    const { context, companyId: effectiveCompanyId } = await requireTicketWrite(
      data.company_id ?? undefined,
    );
    const ticketId = BigInt(id);
    const priorWritable = await assertTicketWritable(ticketId, effectiveCompanyId);
    await assertTicketNotFullyPaid(ticketId, effectiveCompanyId);
    assertIsWorkTicketRow(priorWritable);

    if (data.client_id != null) {
      await assertClientBelongsToCompany(data.client_id, effectiveCompanyId);
    }

    const servicesToSync = Array.isArray(data.services) ? data.services : null;
    const hasServicesUpdate = servicesToSync !== null;
    if (hasServicesUpdate) {
      z.array(ticketServiceLineSchema).parse(servicesToSync);
    }
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
          .update(servicesTickets)
          .set({ deleted_at: new Date(), updated_at: new Date() })
          .where(
            and(
              eq(servicesTickets.ticket_id, ticketId),
              isNull(servicesTickets.deleted_at),
            ),
          );

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
        client_id?: number;
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

      if (data.client_id != null) {
        ticketUpdateData.client_id = data.client_id;
      }

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
          where: isNull(servicesTickets.deleted_at),
          with: {
            service: true,
          },
        },
      },
    });

    invalidateCompanyCache(effectiveCompanyId, 'dashboard');

    return { success: true, data: full ?? updated };
  } catch (e) {
    if (e instanceof TicketAlreadyPaidError) {
      return buildActionError('TC010', undefined, 'validation');
    }
    if (e instanceof PresupuestoMutationBlockedError) {
      return buildActionError('TC009', undefined, 'validation');
    }
    return handleCodedServerActionError('tickets.update', 'TC004', e);
  }
}

export async function deleteTicket(
  id: number,
  companyId?: number | null,
): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId: effectiveCompanyId } =
      await requireTicketWrite(companyId);
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

    invalidateCompanyCache(effectiveCompanyId, 'dashboard');

    return { success: true };
  } catch (e) {
    if (e instanceof AuthorizationError || e instanceof AuthenticationError) {
      return handleServerActionError(e);
    }
    return handleCodedServerActionError('tickets.delete', 'TC005', e);
  }
}

export async function finishTicket(
  id: number,
  _clientTotal: number,
  paid: number,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId: effectiveCompanyId } =
      await requireTicketWrite(companyId);
    const ticketId = BigInt(id);
    const writable = await assertTicketWritable(ticketId, effectiveCompanyId);
    assertIsWorkTicketRow(writable);
    const prior = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, ticketId),
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
      ),
    });
    if (prior?.finished) {
      return buildActionError('TC006', undefined, 'validation');
    }

    const paidAmount = roundMoney(paid);

    const updated = await db.transaction(async (tx) => {
      await acquireAdvisoryLock(
        tx,
        ADVISORY_LOCK_NAMESPACE.ticketFinish,
        ticketId,
      );

      const activeLines = await tx
        .select({ id: servicesTickets.id })
        .from(servicesTickets)
        .where(
          and(
            eq(servicesTickets.ticket_id, ticketId),
            isNull(servicesTickets.deleted_at),
          ),
        )
        .limit(1);

      if (activeLines.length === 0) {
        throw new EmptyTicketFinishError();
      }

      // Authoritative total comes from active service lines, never the client.
      const totalAmount = await syncTicketTotal(tx, ticketId);

      if (paidAmount - totalAmount > AMOUNT_TOLERANCE) {
        throw new FinishPaidExceedsTotalError();
      }

      const [row] = await tx
        .update(ticket)
        .set({
          finished: true,
          total: totalAmount,
          paid: paidAmount,
        })
        .where(
          and(
            eq(ticket.id, ticketId),
            eq(ticket.company_id, effectiveCompanyId),
            isNull(ticket.deleted_at),
            eq(ticket.finished, false),
          ),
        )
        .returning();

      if (!row) {
        // Concurrent finish won the race; do not insert payment/audit again.
        throw new TicketAlreadyFinishedError();
      }

      if (paidAmount > AMOUNT_TOLERANCE) {
        await tx.insert(ticketPayment).values({
          ticket_id: ticketId,
          amount: paidAmount,
          company_id: row.company_id,
        });
      }

      await recordTicketAudit(
        tx,
        context,
        ticketId,
        effectiveCompanyId,
        'finished',
        {
          before: prior,
          after: row,
          initialPayment: paidAmount > AMOUNT_TOLERANCE ? paidAmount : 0,
          syncedTotal: totalAmount,
          ignoredClientTotal: _clientTotal,
        },
      );

      return row;
    });

    invalidateCompanyCache(effectiveCompanyId, 'dashboard');
    revalidatePath('/dashboard');
    revalidatePath('/tickets');
    revalidatePath('/cobranza');
    revalidatePath(`/tickets/${id}`);

    return { success: true, data: updated };
  } catch (e) {
    if (e instanceof FinishPaidExceedsTotalError) {
      return buildActionError('TC009', undefined, 'validation');
    }
    if (e instanceof EmptyTicketFinishError) {
      return buildActionError('TC009', undefined, 'validation');
    }
    if (e instanceof TicketAlreadyFinishedError) {
      return buildActionError('TC006', undefined, 'validation');
    }
    if (e instanceof PresupuestoMutationBlockedError) {
      return buildActionError('TC009', undefined, 'validation');
    }
    if (e instanceof AuthorizationError || e instanceof AuthenticationError) {
      return handleServerActionError(e);
    }
    return handleCodedServerActionError('tickets.finish', 'TC006', e);
  }
}

export async function applyTicketPayment(
  id: number,
  additionalPaid: number,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId: effectiveCompanyId } =
      await requireTicketWrite(companyId);
    const ticketId = BigInt(id);
    const writable = await assertTicketWritable(ticketId, effectiveCompanyId);
    assertIsWorkTicketRow(writable);

    if (!Number.isFinite(additionalPaid) || additionalPaid <= 0) {
      return buildActionError('TC007', undefined, 'validation');
    }

    // Fast pre-validation (fails before opening a transaction).
    const ticketRow = await db.query.ticket.findFirst({
      where: and(eq(ticket.id, ticketId), isNull(ticket.deleted_at)),
    });

    if (!ticketRow) {
      return buildActionError('TC008');
    }

    if (!ticketRow.finished) {
      return buildActionError(
        'TC007',
        new AppError(
          'Finaliza el ticket antes de registrar un cobro.',
          400,
          true,
          'TC007',
        ),
        'validation',
      );
    }

    if (getTicketBalanceDue(ticketRow.total, ticketRow.paid) <= 0) {
      return buildActionError(
        'TC007',
        new AppError(
          'Este ticket ya está saldado.',
          400,
          true,
          'TC007',
        ),
        'validation',
      );
    }

    const currentPaid = roundMoney(Number(ticketRow.paid ?? 0));
    const totalAmount = roundMoney(Number(ticketRow.total ?? 0));
    const previewPaid = roundMoney(
      Math.min(totalAmount, addMoney(currentPaid, additionalPaid)),
    );
    if (subtractMoney(previewPaid, currentPaid) <= AMOUNT_TOLERANCE) {
      return buildActionError('TC007', undefined, 'validation');
    }

    // Authoritative read + write happen inside one transaction guarded by a
    // Postgres advisory lock so concurrent collections cannot double-apply.
    const result = await db.transaction(async (tx) => {
      await acquireAdvisoryLock(
        tx,
        ADVISORY_LOCK_NAMESPACE.ticketPayment,
        ticketId,
      );

      const fresh = await tx.query.ticket.findFirst({
        where: and(eq(ticket.id, ticketId), isNull(ticket.deleted_at)),
      });

      if (!fresh || !fresh.finished) {
        return { status: 'invalid' as const };
      }

      const freshTotal = roundMoney(Number(fresh.total ?? 0));
      const freshPaid = roundMoney(Number(fresh.paid ?? 0));
      const newPaid = roundMoney(
        Math.min(freshTotal, addMoney(freshPaid, additionalPaid)),
      );
      const appliedAmount = subtractMoney(newPaid, freshPaid);

      if (appliedAmount <= AMOUNT_TOLERANCE) {
        // A concurrent collection already covered this balance; no-op.
        return { status: 'noop' as const, row: fresh };
      }

      await tx.insert(ticketPayment).values({
        ticket_id: ticketId,
        amount: appliedAmount,
        company_id: fresh.company_id,
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
            before: fresh,
            after: row,
            payment: {
              requestedAmount: additionalPaid,
              appliedAmount,
            },
          },
        );
      }

      return { status: 'ok' as const, row };
    });

    if (result.status === 'invalid') {
      return buildActionError(
        'TC007',
        new AppError(
          'Finaliza el ticket antes de registrar un cobro.',
          400,
          true,
          'TC007',
        ),
        'validation',
      );
    }

    invalidateCompanyCache(effectiveCompanyId, 'dashboard');
    revalidatePath('/dashboard');
    revalidatePath('/tickets');
    revalidatePath('/cobranza');
    revalidatePath(`/tickets/${id}`);

    return { success: true, data: result.row };
  } catch (e) {
    if (e instanceof PresupuestoMutationBlockedError) {
      return buildActionError('TC009', undefined, 'validation');
    }
    if (e instanceof AuthorizationError || e instanceof AuthenticationError) {
      return handleServerActionError(e);
    }
    return handleCodedServerActionError('tickets.collect-payment', 'TC007', e);
  }
}

/** Active tickets for the caller's company as CSV-ready rows. */
export async function getTicketsForExport(
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: Array<Record<(typeof TICKET_CSV_HEADERS)[number], string>>;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } =
      await requireTenantTicketRead(companyId);
    const rows = await db
      .select()
      .from(ticket)
      .where(
        and(
          eq(ticket.company_id, effectiveCompanyId),
          isNull(ticket.deleted_at),
          eq(ticket.document_kind, 'ticket'),
        ),
      )
      .orderBy(desc(ticket.created_at));

    return {
      success: true,
      data: rows.map((row) => {
        const total = row.total ?? 0;
        const paid = row.paid ?? 0;
        const ref = row.ticket_date ?? row.created_at;
        return {
          id: row.id.toString(),
          cliente: row.client_name ?? '',
          telefono: row.client_tel ?? '',
          email: row.email ?? '',
          fecha: ref ? formatDate(ref, 'yyyy-MM-dd') : '',
          total: total.toFixed(2),
          pagado: paid.toFixed(2),
          saldo: getTicketBalanceDue(row.total, row.paid).toFixed(2),
          estado: TICKET_PAYMENT_STATUS_LABEL[
            getTicketPaymentStatus(row.total, row.paid)
          ],
          finalizado: row.finished ? 'Sí' : 'No',
        };
      }),
    };
  } catch (e) {
    return handleCodedServerActionError('tickets.export', 'TC001', e);
  }
}

export type TicketAuditHistoryEntry = {
  id: number;
  eventType: string;
  createdAt: Date;
  actorName: string | null;
  payload: Record<string, unknown> | null;
};

/**
 * Tenant-facing immutable history for a ticket, read from `TicketAuditEvent`.
 * Scoped by company (system operators may read any ticket). Sensitive payload
 * values are redacted before returning to the UI.
 */
export async function getTicketAuditHistory(id: number): Promise<{
  success: boolean;
  data?: TicketAuditHistoryEntry[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId } = await requireTicketRead();
    const ticketId = BigInt(id);

    const ticketRow = await db.query.ticket.findFirst({
      where: and(eq(ticket.id, ticketId), isNull(ticket.deleted_at)),
    });
    if (!ticketRow) {
      return buildActionError('TC008');
    }
    if (!context.companyIsSystem && ticketRow.company_id !== companyId) {
      return buildActionError('TC008');
    }

    const events = await db.query.ticketAuditEvent.findMany({
      where: eq(ticketAuditEvent.ticket_id, ticketId),
      with: { actor: true },
      orderBy: [desc(ticketAuditEvent.created_at)],
    });

    const data: TicketAuditHistoryEntry[] = events.map((event) => ({
      id: event.id,
      eventType: event.event_type,
      createdAt: event.created_at,
      actorName: event.actor?.name ?? null,
      payload: (redactAuditDisplayValue(event.payload) ?? null) as
        | Record<string, unknown>
        | null,
    }));

    return { success: true, data };
  } catch (e) {
    return handleCodedServerActionError('tickets.audit-history', 'TC001', e);
  }
}
