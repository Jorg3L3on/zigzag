'use server';

import { allocateDocumentFolio } from '@/lib/folio-allocator';
import { formatDocumentFolio, normalizeFolioSearch, parseFolioSearch, type FolioParts } from '@/lib/folio';
import { revalidatePath } from 'next/cache';
import { desc, eq, and, isNull, sql, count, ilike, or, inArray } from 'drizzle-orm';
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
  type TicketLineMaterialRow,
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
  buildValidationActionError,
  handleCodedServerActionError,
  handleServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import type { ValidationIssue } from '@/lib/action-result';
import {
  assertTicketTotalWithinCap,
  calculateTicketTotal,
  syncTicketTotal,
} from '@/lib/ticket-financials';
import { addMoney, roundMoney, subtractMoney } from '@/lib/money';
import {
  AMOUNT_TOLERANCE,
  getTicketBalanceDue,
  isTicketFullyPaid,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import {
  assertCompanyProductionReady,
  CompanyProductionBlockedError,
} from '@/lib/company-production-guard';
import { requireTicketRead, requireTicketWrite } from '@/lib/tickets-rbac-server';
import type { ActionAuthContext } from '@/lib/authz-context';
import { isWorkTicket } from '@/lib/ticket-document-kind';
import {
  composerServiceLineSchema,
  serviceLineInputSchema,
  type ServiceLineInput,
} from '@/lib/ticket-service-line-schema';
import {
  assertCatalogServicesBelongToCompany,
  catalogServiceIds,
  insertServiceLines,
} from '@/lib/service-lines-server';
import { activeLineMaterialsWith } from '@/lib/line-materials-query';
import { buildTicketDuplicateDraft, type TicketDuplicateDraft } from '@/lib/ticket-edit-state';
import { z } from 'zod';

const ticketServiceLineSchema = serviceLineInputSchema;

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
  services?: ServiceLineInput[];
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
  /** Company folio (ZIG-I17-4); null only on rows from before migration 0032. */
  folio_number?: number | null;
  folio_prefix?: string | null;
  document_kind?: string | null;
  converted_from_ticket_id?: bigint | null;
  /** "Compresor, Mano de obra": the work, for list cards (ZIG-I18-8). */
  services_summary?: string | null;
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
      /** Active materials (ZIG-I10); absent in fixtures that predate them. */
      materials?: TicketLineMaterialRow[];
    }
  >;
  /** Present when loaded with `with`; lista suele omitirla. */
  ticket_payments?: TicketPaymentRow[];
  /** Folio of the presupuesto this ticket came from; the recibo shows it (ZIG-I17-5). */
  source_presupuesto_folio?: FolioParts | null;
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
        const folio = await allocateDocumentFolio(tx, {
          companyId: effectiveCompanyId,
          documentKind: 'ticket',
        });
        const [row] = await tx
          .insert(ticket)
          .values({ ...values, ...folio })
          .returning();
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
        const folio = await allocateDocumentFolio(tx, {
          companyId: effectiveCompanyId,
          documentKind: 'ticket',
        });
        const [row] = await tx
          .insert(ticket)
          .values({ ...values, ...folio })
          .returning();
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

/** Catalog or inline line (ZIG-I5) with the composer's quantity/price limits. */
const composerLineSchema = composerServiceLineSchema;

const createTicketWithLinesSchema = z.object({
  company_id: z.number().int().positive(),
  client_id: z.number().int().positive(),
  ticket_date: z.coerce.date(),
  work_notes: z.string().trim().max(2000).optional().default(''),
  lines: z.array(composerLineSchema).min(1).max(50),
  /** What the composer showed; audit only. The server always recomputes the total. */
  client_total: z.number().finite().optional(),
});

export type CreateTicketWithLinesInput = z.input<
  typeof createTicketWithLinesSchema
>;

const TICKET_EMAIL_MAX_LENGTH = 40;

/**
 * Nuevo ticket composer (ZIG-I2 D2): creates the ticket and all its lines in one
 * transaction. Nothing is persisted before this call. Client snapshot fields come
 * from the tenant's client row and the total is server-authoritative.
 */
export async function createTicketWithLines(
  input: CreateTicketWithLinesInput,
): Promise<{
  success: boolean;
  data?: { id: string; total: number; folio?: string };
  error?: string;
  errorType?: ActionErrorType;
  /** Which line and field the server rejected (validation failures). */
  issues?: ValidationIssue[];
}> {
  try {
    const validated = createTicketWithLinesSchema.parse(input);
    assertTicketTotalWithinCap(calculateTicketTotal(validated.lines));
    const { context, companyId: effectiveCompanyId } = await requireTicketWrite(
      validated.company_id,
    );

    await assertCompanyProductionReady(effectiveCompanyId);

    const clientRow = await db.query.client.findFirst({
      where: and(
        eq(client.id, validated.client_id),
        eq(client.company_id, effectiveCompanyId),
        isNull(client.deleted_at),
      ),
      columns: {
        id: true,
        name: true,
        phone: true,
        email: true,
        document: true,
      },
    });
    if (!clientRow) {
      throw new AuthorizationError('Client not found for this company');
    }

    await assertCatalogServicesBelongToCompany(
      db,
      catalogServiceIds(validated.lines),
      effectiveCompanyId,
    );

    const ticketValues = {
      client_id: clientRow.id,
      client_name: clientRow.name.slice(0, 100),
      client_tel: clientRow.phone ?? '',
      email:
        clientRow.email && clientRow.email.length <= TICKET_EMAIL_MAX_LENGTH
          ? clientRow.email
          : null,
      document: clientRow.document ?? null,
      work_notes: validated.work_notes || null,
      ticket_date: validated.ticket_date,
      company_id: effectiveCompanyId,
      userId: BigInt(context.userId),
      document_kind: 'ticket' as const,
      finished: false,
      paid: 0,
      total: 0,
    };

    const runTransaction = () =>
      db.transaction(async (tx) => {
        const folio = await allocateDocumentFolio(tx, {
          companyId: effectiveCompanyId,
          documentKind: 'ticket',
        });
        const [created] = await tx
          .insert(ticket)
          .values({ ...ticketValues, ...folio })
          .returning();

        const { rows: lineRows, createdServiceIds, createdMaterialIds } =
          await insertServiceLines(tx, {
            companyId: effectiveCompanyId,
            ticketId: created.id,
            lines: validated.lines,
          });

        const syncedTotal = await syncTicketTotal(tx, created.id);

        await recordTicketAudit(
          tx,
          context,
          created.id,
          effectiveCompanyId,
          'created',
          {
            ticket: { ...created, total: syncedTotal },
            source: 'composer',
            lines: lineRows,
            ...(createdServiceIds.length > 0
              ? { savedToCatalogServiceIds: createdServiceIds }
              : {}),
            ...(createdMaterialIds.length > 0
              ? { savedToCatalogMaterialIds: createdMaterialIds }
              : {}),
            syncedTotal,
            ignoredClientTotal: validated.client_total ?? null,
          },
        );

        return { id: created.id, total: syncedTotal, folio: formatDocumentFolio(created) };
      });

    let created: { id: bigint; total: number; folio: string };
    try {
      created = await runTransaction();
    } catch (error) {
      if (!isTicketPrimaryKeyConflict(error)) {
        throw error;
      }
      await syncTicketIdSequence();
      created = await runTransaction();
    }

    invalidateCompanyCache(effectiveCompanyId, 'dashboard');
    revalidatePath('/dashboard');
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${String(created.id)}`);

    return {
      success: true,
      data: { id: String(created.id), total: created.total, folio: created.folio },
    };
  } catch (error) {
    if (error instanceof CompanyProductionBlockedError) {
      return handleServerActionError(error);
    }
    if (error instanceof AuthorizationError || error instanceof AuthenticationError) {
      return handleServerActionError(error);
    }
    if (error instanceof z.ZodError) {
      return buildValidationActionError(error);
    }
    return handleCodedServerActionError('tickets.composer.create', 'TC001', error);
  }
}

const updateTicketLinesSchema = z.object({
  company_id: z.number().int().positive(),
  /** Only applied while the ticket is En proceso (not finalized). */
  client_id: z.number().int().positive().optional(),
  ticket_date: z.coerce.date().optional(),
  work_notes: z.string().trim().max(2000).optional(),
  lines: z.array(composerLineSchema).min(1).max(50),
});

export type UpdateTicketLinesInput = z.input<typeof updateTicketLinesSchema>;

/** The new total would fall below what the client already paid. */
class TotalBelowPaidError extends Error {
  constructor(public readonly paid: number) {
    super('Total below the amount already paid');
    this.name = 'TotalBelowPaidError';
  }
}

const formatPesos = (amount: number) =>
  `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The one ticket line editor (ZIG-I13-6): replaces the whole set of lines and
 * their materials in one transaction, re-syncs the total, audits before/after and
 * refuses a total below what is already paid. Client and date change only while
 * the ticket is En proceso; a settled ticket cannot be edited at all.
 */
export async function updateTicketLines(
  id: number,
  input: UpdateTicketLinesInput,
): Promise<{
  success: boolean;
  data?: { id: string; total: number; previousTotal: number; finished: boolean };
  error?: string;
  errorType?: ActionErrorType;
  issues?: ValidationIssue[];
}> {
  try {
    const validated = updateTicketLinesSchema.parse(input);
    assertTicketTotalWithinCap(calculateTicketTotal(validated.lines));
    const { context, companyId: effectiveCompanyId } = await requireTicketWrite(
      validated.company_id,
    );
    const ticketId = BigInt(id);
    const prior = await assertTicketWritable(ticketId, effectiveCompanyId);
    assertIsWorkTicketRow(prior);
    await assertTicketNotFullyPaid(ticketId, effectiveCompanyId);

    const paid = prior.paid ?? 0;
    if (calculateTicketTotal(validated.lines) < paid - AMOUNT_TOLERANCE) {
      throw new TotalBelowPaidError(paid);
    }

    await assertCatalogServicesBelongToCompany(
      db,
      catalogServiceIds(validated.lines),
      effectiveCompanyId,
    );

    const editable = !prior.finished;
    let clientSnapshot:
      | {
          client_id: number;
          client_name: string;
          client_tel: string;
          email: string | null;
          document: string | null;
        }
      | undefined;
    if (editable && validated.client_id != null && validated.client_id !== prior.client_id) {
      const clientRow = await db.query.client.findFirst({
        where: and(
          eq(client.id, validated.client_id),
          eq(client.company_id, effectiveCompanyId),
          isNull(client.deleted_at),
        ),
        columns: { id: true, name: true, phone: true, email: true, document: true },
      });
      if (!clientRow) {
        throw new AuthorizationError('Client not found for this company');
      }
      clientSnapshot = {
        client_id: clientRow.id,
        client_name: clientRow.name.slice(0, 100),
        client_tel: clientRow.phone ?? '',
        email:
          clientRow.email && clientRow.email.length <= TICKET_EMAIL_MAX_LENGTH
            ? clientRow.email
            : null,
        document: clientRow.document ?? null,
      };
    }

    const beforeLines = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, ticketId),
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
      ),
      with: {
        services_tickets: {
          where: isNull(servicesTickets.deleted_at),
          with: { ...activeLineMaterialsWith },
        },
      },
    });

    const result = await db.transaction(async (tx) => {
      await tx
        .update(servicesTickets)
        .set({ deleted_at: new Date(), updated_at: new Date() })
        .where(
          and(eq(servicesTickets.ticket_id, ticketId), isNull(servicesTickets.deleted_at)),
        );

      const { rows: lineRows, createdServiceIds, createdMaterialIds } =
        await insertServiceLines(tx, {
          companyId: effectiveCompanyId,
          ticketId,
          lines: validated.lines,
        });

      const syncedTotal = await syncTicketTotal(tx, ticketId);
      if (syncedTotal < paid - AMOUNT_TOLERANCE) {
        // Rolls the replacement back: the lines stay as they were.
        throw new TotalBelowPaidError(paid);
      }

      const [row] = await tx
        .update(ticket)
        .set({
          ...(clientSnapshot ?? {}),
          ...(editable && validated.ticket_date ? { ticket_date: validated.ticket_date } : {}),
          ...(validated.work_notes !== undefined
            ? { work_notes: validated.work_notes || null }
            : {}),
          updated_at: new Date(),
        })
        .where(
          and(
            eq(ticket.id, ticketId),
            eq(ticket.company_id, effectiveCompanyId),
            isNull(ticket.deleted_at),
          ),
        )
        .returning();

      await recordTicketAudit(tx, context, ticketId, effectiveCompanyId, 'updated', {
        before: beforeLines,
        after: row,
        servicesChanged: true,
        source: 'composer-edit',
        previousTotal: prior.total ?? 0,
        total: syncedTotal,
        lines: lineRows,
        ...(createdServiceIds.length > 0 ? { savedToCatalogServiceIds: createdServiceIds } : {}),
        ...(createdMaterialIds.length > 0 ? { savedToCatalogMaterialIds: createdMaterialIds } : {}),
      });

      return syncedTotal;
    });

    invalidateCompanyCache(effectiveCompanyId, 'dashboard');
    revalidatePath('/dashboard');
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${String(ticketId)}`);

    return {
      success: true,
      data: {
        id: String(ticketId),
        total: result,
        previousTotal: prior.total ?? 0,
        finished: prior.finished,
      },
    };
  } catch (error) {
    if (error instanceof TotalBelowPaidError) {
      return {
        success: false,
        error: `El total no puede quedar abajo de lo ya pagado (${formatPesos(error.paid)})`,
        errorType: 'validation',
      };
    }
    if (error instanceof TicketAlreadyPaidError) {
      return buildActionError('TC010', undefined, 'validation');
    }
    if (error instanceof PresupuestoMutationBlockedError) {
      return buildActionError('TC009', undefined, 'validation');
    }
    if (error instanceof AuthorizationError || error instanceof AuthenticationError) {
      return handleServerActionError(error);
    }
    if (error instanceof z.ZodError) {
      return buildValidationActionError(error);
    }
    return handleCodedServerActionError('tickets.update-lines', 'TC004', error);
  }
}

/**
 * Notes in the audit log that the recibo went out (ZIG-I13-6), so editing a
 * finalized ticket can say "el recibo se compartió el …" and offer to resend.
 * Company-scoped; any role that can read tickets (and so share the recibo) can log it.
 */
export async function recordReceiptShared(
  id: number,
  companyId?: number | null,
): Promise<{ success: boolean; error?: string; errorType?: ActionErrorType }> {
  try {
    const { context, companyId: effectiveCompanyId } = await requireTicketRead(
      companyId ?? undefined,
    );
    const ticketId = BigInt(id);
    const row = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, ticketId),
        eq(ticket.company_id, effectiveCompanyId),
        eq(ticket.document_kind, 'ticket'),
        isNull(ticket.deleted_at),
      ),
      columns: { id: true, total: true, paid: true },
    });
    if (!row) {
      return buildActionError('TC008');
    }
    await db.transaction(async (tx) => {
      await recordTicketAudit(tx, context, ticketId, effectiveCompanyId, 'receipt_shared', {
        total: row.total,
        paid: row.paid,
      });
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof AuthenticationError) {
      return handleServerActionError(error);
    }
    return handleCodedServerActionError('tickets.receipt-shared', 'TC003', error);
  }
}

/**
 * Duplicar ticket (ZIG-I13-6): the same client, lines and materials as a draft for
 * the ticket composer, dated today, no payments. Company-scoped; nothing is saved
 * until Guardar.
 */
export async function duplicateTicket(
  id: number,
  companyId?: number | null,
): Promise<
  | { success: true; data: TicketDuplicateDraft }
  | { success: false; error?: string; errorType?: ActionErrorType }
> {
  try {
    const { companyId: effectiveCompanyId } = await requireTicketWrite(companyId ?? undefined);
    const source = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, BigInt(id)),
        eq(ticket.company_id, effectiveCompanyId),
        eq(ticket.document_kind, 'ticket'),
        isNull(ticket.deleted_at),
      ),
      with: {
        client: true,
        services_tickets: {
          where: isNull(servicesTickets.deleted_at),
          with: { service: true, ...activeLineMaterialsWith },
        },
      },
    });
    if (!source) {
      return buildActionError('TC008');
    }
    return {
      success: true,
      data: buildTicketDuplicateDraft(source as unknown as TicketDetailData),
    };
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof AuthenticationError) {
      return handleServerActionError(error);
    }
    return handleCodedServerActionError('tickets.duplicate', 'TC003', error);
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
            ...activeLineMaterialsWith,
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
  items: Array<TicketRow & { services_summary: string | null }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Σ saldo of every ticket matching the filters, not just this page (ZIG-I13-7). */
  balanceDue: number;
  /** Tickets with a saldo under the search/date/finished filters, whatever the status chip (ZIG-I13-7). */
  dueCount: number;
}

/** `due` = Por cobrar: any ticket with a saldo (parcial or sin pagos). */
export type TicketListPaymentFilter = TicketPaymentStatus | 'due' | 'all';

export type TicketListFinishedFilter = 'all' | 'yes' | 'no';

/** A ticket with a saldo: parcial or sin pagos, never a zero-total one. */
const TICKET_DUE_CONDITION = sql`COALESCE(${ticket.total}, 0) > 0.01 AND COALESCE(${ticket.paid}, 0) < COALESCE(${ticket.total}, 0) - 0.01`;

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

  if (status === 'due') {
    return TICKET_DUE_CONDITION;
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

    const folioSearch = search ? parseFolioSearch(search) : null;
    const searchCondition = search
      ? or(
          ilike(ticket.client_name, `%${search}%`),
          ilike(ticket.email, `%${search}%`),
          ilike(ticket.document, `%${search}%`),
          ilike(ticket.client_tel, `%${search}%`),
          sql`CAST(${ticket.id} AS TEXT) LIKE ${`%${search}%`}`,
          // R-0012, r-12 or 0012: the stored prefix plus the padded number (ZIG-I17-6).
          sql`(${ticket.folio_prefix} || '-' || lpad(${ticket.folio_number}::text, 4, '0')) ILIKE ${`%${normalizeFolioSearch(search)}%`}`,
          // r34 / R-34 / 34 find R-0034 even though the stored text is padded.
          ...(folioSearch
            ? [
                and(
                  eq(ticket.folio_number, folioSearch.number),
                  folioSearch.prefix
                    ? ilike(ticket.folio_prefix, `${folioSearch.prefix.replace(/[%_\\]/g, '')}%`)
                    : undefined,
                ),
              ]
            : []),
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

    const baseConditions = [
      eq(ticket.company_id, effectiveCompanyId),
      isNull(ticket.deleted_at),
      eq(ticket.document_kind, 'ticket'),
      ...(searchCondition ? [searchCondition] : []),
      ...(finishedCondition ? [finishedCondition] : []),
      ...(dateFromCondition ? [dateFromCondition] : []),
      ...(dateToCondition ? [dateToCondition] : []),
    ];
    const whereCondition = and(
      ...baseConditions,
      ...(paymentStatusCondition ? [paymentStatusCondition] : []),
    );

    const [{ total, balanceDue }] = await db
      .select({
        total: count(),
        balanceDue: sql<string>`COALESCE(SUM(CASE WHEN ${TICKET_DUE_CONDITION} THEN COALESCE(${ticket.total}, 0) - COALESCE(${ticket.paid}, 0) ELSE 0 END), 0)`,
      })
      .from(ticket)
      .where(whereCondition);
    const [{ dueCount }] = await db
      .select({ dueCount: count() })
      .from(ticket)
      .where(and(...baseConditions, TICKET_DUE_CONDITION));

    const totalCount = Number(total ?? 0);
    const items = await db
      .select()
      .from(ticket)
      .where(whereCondition)
      .orderBy(desc(ticket.created_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // The work done, one aggregate over this page's ids (no N+1, company-scoped).
    const pageIds = items.map((row) => row.id);
    const serviceLines = pageIds.length
      ? await db
          .select({
            ticket_id: servicesTickets.ticket_id,
            summary: sql<string | null>`string_agg(coalesce(${servicesTickets.name}, ${service.name}), ', ' order by ${servicesTickets.id})`,
          })
          .from(servicesTickets)
          .innerJoin(ticket, eq(ticket.id, servicesTickets.ticket_id))
          .leftJoin(service, eq(service.id, servicesTickets.service_id))
          .where(
            and(
              eq(ticket.company_id, effectiveCompanyId),
              isNull(ticket.deleted_at),
              eq(ticket.document_kind, 'ticket'),
              inArray(servicesTickets.ticket_id, pageIds),
              isNull(servicesTickets.deleted_at),
            ),
          )
          .groupBy(servicesTickets.ticket_id)
      : [];
    const summaryByTicket = new Map(
      serviceLines.map((r) => [String(r.ticket_id), r.summary]),
    );

    return {
      success: true,
      data: {
        items: items.map((row) => ({
          ...row,
          services_summary: summaryByTicket.get(String(row.id)) ?? null,
        })),
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
        balanceDue: roundMoney(Number(balanceDue ?? 0)),
        dueCount: Number(dueCount ?? 0),
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
            ...activeLineMaterialsWith,
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

    let sourceFolio: FolioParts | null = null;
    if (ticketRow.converted_from_ticket_id != null) {
      const source = await db.query.ticket.findFirst({
        where: eq(ticket.id, ticketRow.converted_from_ticket_id),
        columns: { folio_number: true, folio_prefix: true },
      });
      sourceFolio = source && source.folio_number != null ? source : null;
    }

    return {
      success: true,
      data: { ...ticketRow, source_presupuesto_folio: sourceFolio } as TicketDetailData,
    };
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

    const servicesToSync = Array.isArray(data.services)
      ? z.array(ticketServiceLineSchema).parse(data.services)
      : null;
    const hasServicesUpdate = servicesToSync !== null;
    const totalFromServices = hasServicesUpdate
      ? assertTicketTotalWithinCap(calculateTicketTotal(servicesToSync))
      : undefined;

    if (hasServicesUpdate) {
      await assertCatalogServicesBelongToCompany(
        db,
        catalogServiceIds(servicesToSync),
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
          with: { ...activeLineMaterialsWith },
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
          await insertServiceLines(tx, {
            companyId: effectiveCompanyId,
            ticketId,
            lines: servicesToSync,
          });
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
            ...activeLineMaterialsWith,
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
