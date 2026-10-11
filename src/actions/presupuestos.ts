'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  servicesTickets,
  ticket,
  ticketLineMaterial,
  type Client,
  type Service,
  type ServicesTicketsRow,
  type TicketLineMaterialRow,
  type TicketRow,
} from '@/db/schema';
import { db } from '@/lib/db';
import {
  AuthenticationError,
  AuthorizationError,
  buildActionError,
  buildValidationActionError,
  type CodedActionError,
  handleCodedServerActionError,
  handleServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import type { ValidationIssue } from '@/lib/action-result';
import {
  assertCompanyProductionReady,
  CompanyProductionBlockedError,
} from '@/lib/company-production-guard';
import { invalidateCompanyCache } from '@/lib/cache';
import { recordTicketAudit } from '@/lib/ticket-audit';
import {
  assertTicketTotalWithinCap,
  calculateTicketTotal,
  syncTicketTotal,
} from '@/lib/ticket-financials';
import { requireTicketRead, requireTicketWrite } from '@/lib/tickets-rbac-server';
import {
  getPresupuestoStatus,
  isPresupuestoMutable,
  isPresupuestoTicket,
  PRESUPUESTO_STATUS_LABEL,
  type PresupuestoStatus,
} from '@/lib/ticket-document-kind';
import { client, service } from '@/db/schema';
import {
  composerServiceLineSchema,
  serviceLineInputSchema,
} from '@/lib/ticket-service-line-schema';
import {
  catalogServiceIds,
  copyLineMaterialValues,
  copyServiceLineValues,
  insertServiceLines,
} from '@/lib/service-lines-server';
import { activeLineMaterialsWith } from '@/lib/line-materials-query';
import {
  buildPresupuestoDuplicateDraft,
  type PresupuestoDuplicateDraft,
} from '@/lib/presupuesto-view-props';

/** Catalog or inline line (ZIG-I5). */
const serviceLineSchema = serviceLineInputSchema;

const presupuestoSchema = z.object({
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
  expires_at: z.date().nullable().optional(),
  work_notes: z.string().trim().max(2000).nullable().optional(),
  company_id: z.number(),
  services: z.array(serviceLineSchema).optional(),
});

export type CreatePresupuestoInput = z.input<typeof presupuestoSchema>;

export type PresupuestoListItem = {
  id: string;
  clientName: string | null;
  clientTel: string | null;
  ticketDate: string | null;
  expiresAt: string | null;
  total: number | null;
  status: PresupuestoStatus;
  statusLabel: string;
  convertedToTicketId: string | null;
  canceledAt: string | null;
};

const assertClientBelongsToCompany = async (
  clientId: number | undefined,
  companyId: number,
) => {
  if (clientId == null) return;
  const row = await db.query.client.findFirst({
    where: and(
      eq(client.id, clientId),
      eq(client.company_id, companyId),
      isNull(client.deleted_at),
    ),
    columns: { id: true },
  });
  if (!row) {
    throw new AuthorizationError('Client not found for this company');
  }
};

const assertServicesBelongToCompany = async (
  serviceIds: number[],
  companyId: number,
) => {
  const unique = Array.from(new Set(serviceIds));
  if (unique.length === 0) return;
  const rows = await db.query.service.findMany({
    where: and(
      eq(service.company_id, companyId),
      isNull(service.deleted_at),
    ),
    columns: { id: true },
  });
  const allowed = new Set(rows.map((row) => row.id));
  for (const id of unique) {
    if (!allowed.has(id)) {
      throw new AuthorizationError('Service not found for this company');
    }
  }
};

const toListItem = (row: TicketRow): PresupuestoListItem => {
  const status = getPresupuestoStatus(row);
  return {
    id: String(row.id),
    clientName: row.client_name,
    clientTel: row.client_tel,
    ticketDate: row.ticket_date?.toISOString() ?? null,
    expiresAt: row.expires_at?.toISOString() ?? null,
    total: row.total,
    status,
    statusLabel: PRESUPUESTO_STATUS_LABEL[status],
    convertedToTicketId:
      row.converted_to_ticket_id != null
        ? String(row.converted_to_ticket_id)
        : null,
    canceledAt: row.canceled_at?.toISOString() ?? null,
  };
};

export async function getPresupuestosList(
  companyId: number | null,
): Promise<{
  success: boolean;
  data?: PresupuestoListItem[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireTicketRead(
      companyId ?? undefined,
    );

    const rows = await db.query.ticket.findMany({
      where: and(
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
        eq(ticket.document_kind, 'presupuesto'),
      ),
      orderBy: [desc(ticket.created_at)],
    });

    return { success: true, data: rows.map(toListItem) };
  } catch (e) {
    return handleCodedServerActionError('presupuestos.list', 'TC002', e);
  }
}

const TICKET_EMAIL_MAX_LENGTH = 40;

const startOfDay = (value: Date): number => {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

const createPresupuestoWithLinesSchema = z
  .object({
    company_id: z.number().int().positive(),
    client_id: z.number().int().positive(),
    ticket_date: z.coerce.date(),
    expires_at: z.coerce.date().nullable().optional(),
    work_notes: z.string().trim().max(2000).optional().default(''),
    lines: z.array(composerServiceLineSchema).min(1).max(50),
    /** What the composer showed; audit only. The server always recomputes the total. */
    client_total: z.number().finite().optional(),
  })
  .refine(
    (value) =>
      value.expires_at == null ||
      startOfDay(value.expires_at) >= startOfDay(value.ticket_date),
    { message: 'La vigencia no puede ser anterior a la fecha', path: ['expires_at'] },
  );

export type CreatePresupuestoWithLinesInput = z.input<
  typeof createPresupuestoWithLinesSchema
>;

/**
 * Nuevo presupuesto composer (ZIG-I5 D1): creates the quote and all its lines
 * (catalog or inline) in one transaction. Nothing is persisted before this call.
 * Client snapshot fields come from the tenant's client row and the total is
 * server-authoritative.
 */
export async function createPresupuestoWithLines(
  input: CreatePresupuestoWithLinesInput,
): Promise<{
  success: boolean;
  data?: { id: string; total: number };
  error?: string;
  errorType?: ActionErrorType;
  /** Which line and field the server rejected (validation failures). */
  issues?: ValidationIssue[];
}> {
  try {
    const validated = createPresupuestoWithLinesSchema.parse(input);
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

    await assertServicesBelongToCompany(
      catalogServiceIds(validated.lines),
      effectiveCompanyId,
    );

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(ticket)
        .values({
          client_id: clientRow.id,
          client_name: clientRow.name.slice(0, 100),
          client_tel: (clientRow.phone ?? '').slice(0, 20),
          email:
            clientRow.email && clientRow.email.length <= TICKET_EMAIL_MAX_LENGTH
              ? clientRow.email
              : null,
          document: clientRow.document ?? null,
          work_notes: validated.work_notes || null,
          ticket_date: validated.ticket_date,
          expires_at: validated.expires_at ?? null,
          company_id: effectiveCompanyId,
          userId: BigInt(context.userId),
          document_kind: 'presupuesto',
          finished: false,
          paid: 0,
          total: 0,
        })
        .returning();

      const { rows: lineRows, createdServiceIds, createdMaterialIds } =
        await insertServiceLines(tx, {
          companyId: effectiveCompanyId,
          ticketId: row.id,
          lines: validated.lines,
        });

      const syncedTotal = await syncTicketTotal(tx, row.id);

      await recordTicketAudit(tx, context, row.id, effectiveCompanyId, 'created', {
        ticket: { ...row, total: syncedTotal },
        document_kind: 'presupuesto',
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
      });

      return { id: row.id, total: syncedTotal };
    });

    invalidateCompanyCache(effectiveCompanyId, 'dashboard');
    revalidatePath('/presupuestos');

    return {
      success: true,
      data: { id: String(created.id), total: created.total },
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
    return handleCodedServerActionError('presupuestos.composer.create', 'TC001', error);
  }
}

export type PresupuestoDetailData = TicketRow & {
  client?: Client | null;
  services_tickets: Array<
    ServicesTicketsRow & {
      service: Service | null;
      materials?: TicketLineMaterialRow[];
    }
  >;
};

/**
 * One presupuesto for its review and detail pages (ZIG-I5-4). Tenant-scoped and
 * limited to document_kind = 'presupuesto': a work ticket id is not found here.
 */
export async function getPresupuestoById(
  id: number,
  requestedCompanyId?: number | null,
): Promise<{ success: true; data: PresupuestoDetailData } | CodedActionError> {
  try {
    const { companyId } = await requireTicketRead(requestedCompanyId ?? undefined);
    const row = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, BigInt(id)),
        eq(ticket.company_id, companyId),
        eq(ticket.document_kind, 'presupuesto'),
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
    if (!row) {
      return buildActionError('TC008');
    }
    return { success: true, data: row as PresupuestoDetailData };
  } catch (e) {
    return handleCodedServerActionError('presupuestos.get', 'TC003', e);
  }
}

export async function updatePresupuesto(
  id: number,
  data: Partial<CreatePresupuestoInput>,
): Promise<{
  success: boolean;
  data?: PresupuestoListItem;
  error?: string;
  errorType?: ActionErrorType;
  issues?: ValidationIssue[];
}> {
  try {
    const { context, companyId: effectiveCompanyId } = await requireTicketWrite(
      data.company_id ?? undefined,
    );
    const ticketId = BigInt(id);

    const prior = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, ticketId),
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
      ),
    });

    if (!prior || !isPresupuestoTicket(prior.document_kind)) {
      return buildActionError('TC008');
    }
    if (!isPresupuestoMutable(prior)) {
      return buildActionError('TC009', undefined, 'validation');
    }

    if (data.client_id != null) {
      await assertClientBelongsToCompany(data.client_id, effectiveCompanyId);
    }

    const servicesToSync = Array.isArray(data.services)
      ? z.array(serviceLineSchema).parse(data.services)
      : null;
    if (servicesToSync) {
      await assertServicesBelongToCompany(
        catalogServiceIds(servicesToSync),
        effectiveCompanyId,
      );
    }

    const updated = await db.transaction(async (tx) => {
      if (servicesToSync) {
        await tx
          .update(servicesTickets)
          .set({ deleted_at: new Date() })
          .where(
            and(
              eq(servicesTickets.ticket_id, ticketId),
              isNull(servicesTickets.deleted_at),
            ),
          );
        if (servicesToSync.length > 0) {
          await insertServiceLines(tx, {
            companyId: effectiveCompanyId,
            ticketId,
            lines: servicesToSync,
          });
        }
      }

      const totalFromServices = servicesToSync
        ? assertTicketTotalWithinCap(calculateTicketTotal(servicesToSync))
        : undefined;

      const [row] = await tx
        .update(ticket)
        .set({
          ...(data.client_id != null ? { client_id: data.client_id } : {}),
          ...(data.client_name != null ? { client_name: data.client_name } : {}),
          ...(data.client_tel != null ? { client_tel: data.client_tel } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.document !== undefined ? { document: data.document } : {}),
          ...(data.ticket_date != null ? { ticket_date: data.ticket_date } : {}),
          ...(data.work_notes !== undefined
            ? { work_notes: data.work_notes?.trim() || null }
            : {}),
          ...(data.expires_at !== undefined
            ? { expires_at: data.expires_at }
            : {}),
          ...(totalFromServices !== undefined ? { total: totalFromServices } : {}),
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

      if (row) {
        await recordTicketAudit(
          tx,
          context,
          ticketId,
          effectiveCompanyId,
          'updated',
          { before: prior, after: row, document_kind: 'presupuesto' },
        );
      }

      return row;
    });

    if (!updated) {
      return buildActionError('TC008');
    }

    invalidateCompanyCache(effectiveCompanyId, 'dashboard');
    return { success: true, data: toListItem(updated) };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return buildValidationActionError(e);
    }
    return handleCodedServerActionError('presupuestos.update', 'TC004', e);
  }
}

export async function cancelPresupuesto(
  id: number,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: PresupuestoListItem;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId: effectiveCompanyId } = await requireTicketWrite(
      companyId ?? undefined,
    );
    const ticketId = BigInt(id);

    const prior = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, ticketId),
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
      ),
    });

    if (!prior || !isPresupuestoTicket(prior.document_kind)) {
      return buildActionError('TC008');
    }
    if (prior.converted_to_ticket_id != null || prior.canceled_at != null) {
      return buildActionError('TC009', undefined, 'validation');
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(ticket)
        .set({ canceled_at: new Date(), updated_at: new Date() })
        .where(
          and(
            eq(ticket.id, ticketId),
            eq(ticket.company_id, effectiveCompanyId),
            isNull(ticket.deleted_at),
            isNull(ticket.canceled_at),
            isNull(ticket.converted_to_ticket_id),
          ),
        )
        .returning();

      if (row) {
        await recordTicketAudit(
          tx,
          context,
          ticketId,
          effectiveCompanyId,
          'presupuesto_canceled',
          { before: prior, after: row },
        );
      }

      return row;
    });

    if (!updated) {
      return buildActionError('TC009', undefined, 'validation');
    }

    invalidateCompanyCache(effectiveCompanyId, 'dashboard');
    return { success: true, data: toListItem(updated) };
  } catch (e) {
    return handleCodedServerActionError('presupuestos.cancel', 'TC005', e);
  }
}

export async function convertPresupuestoToTicket(
  id: number,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: { presupuesto: PresupuestoListItem; ticketId: string };
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId: effectiveCompanyId } = await requireTicketWrite(
      companyId ?? undefined,
    );
    const sourceId = BigInt(id);

    const source = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, sourceId),
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

    if (!source || !isPresupuestoTicket(source.document_kind)) {
      return buildActionError('TC008');
    }
    if (!isPresupuestoMutable(source)) {
      return buildActionError('TC009', undefined, 'validation');
    }

    const result = await db.transaction(async (tx) => {
      const [workTicket] = await tx
        .insert(ticket)
        .values({
          client_id: source.client_id,
          client_name: source.client_name,
          client_tel: source.client_tel,
          email: source.email,
          document: source.document,
          ticket_date: source.ticket_date ?? new Date(),
          company_id: effectiveCompanyId,
          userId: BigInt(context.userId),
          document_kind: 'ticket',
          finished: false,
          paid: 0,
          total: source.total ?? 0,
          converted_from_ticket_id: sourceId,
        })
        .returning();

      const activeLines = source.services_tickets ?? [];
      // Catalog and inline lines (ZIG-I5) and their materials (ZIG-I10) are
      // copied verbatim. One insert per line keeps each material set on the
      // matching new line id.
      for (const line of activeLines) {
        const [copied] = await tx
          .insert(servicesTickets)
          .values(copyServiceLineValues([line], workTicket.id))
          .returning({ id: servicesTickets.id });
        const lineMaterials = line.materials ?? [];
        if (lineMaterials.length > 0) {
          await tx
            .insert(ticketLineMaterial)
            .values(copyLineMaterialValues(lineMaterials, copied.id));
        }
      }

      const [presupuesto] = await tx
        .update(ticket)
        .set({
          converted_to_ticket_id: workTicket.id,
          updated_at: new Date(),
        })
        .where(
          and(
            eq(ticket.id, sourceId),
            eq(ticket.company_id, effectiveCompanyId),
            isNull(ticket.deleted_at),
            isNull(ticket.converted_to_ticket_id),
            isNull(ticket.canceled_at),
          ),
        )
        .returning();

      if (!presupuesto) {
        throw new Error('PRESUPUESTO_ALREADY_CONVERTED');
      }

      await recordTicketAudit(
        tx,
        context,
        sourceId,
        effectiveCompanyId,
        'presupuesto_converted',
        {
          sourcePresupuestoId: String(sourceId),
          targetTicketId: String(workTicket.id),
        },
      );

      await recordTicketAudit(
        tx,
        context,
        workTicket.id,
        effectiveCompanyId,
        'created',
        {
          ticket: workTicket,
          converted_from_presupuesto_id: String(sourceId),
        },
      );

      return { presupuesto, workTicket };
    });

    invalidateCompanyCache(effectiveCompanyId, 'dashboard');
    return {
      success: true,
      data: {
        presupuesto: toListItem(result.presupuesto),
        ticketId: String(result.workTicket.id),
      },
    };
  } catch (e) {
    if (e instanceof Error && e.message === 'PRESUPUESTO_ALREADY_CONVERTED') {
      return buildActionError('TC009', undefined, 'validation');
    }
    return handleCodedServerActionError('presupuestos.convert', 'TC001', e);
  }
}

/**
 * Duplicar (ZIG-I13-5): reads any presupuesto of the caller's company, whatever
 * its status, and returns a draft for the composer: same client, lines and
 * materials, dated today with the same validity length. Writes nothing but the
 * audit event; the new presupuesto exists only after Guardar.
 */
export async function duplicatePresupuesto(
  id: number,
  companyId?: number | null,
): Promise<{ success: true; data: PresupuestoDuplicateDraft } | CodedActionError> {
  try {
    const { context, companyId: effectiveCompanyId } = await requireTicketWrite(
      companyId ?? undefined,
    );
    const ticketId = BigInt(id);
    const source = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.id, ticketId),
        eq(ticket.company_id, effectiveCompanyId),
        eq(ticket.document_kind, 'presupuesto'),
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

    await db.transaction(async (tx) => {
      await recordTicketAudit(
        tx,
        context,
        ticketId,
        effectiveCompanyId,
        'presupuesto_duplicated',
        { lines: source.services_tickets.length },
      );
    });

    return {
      success: true,
      data: buildPresupuestoDuplicateDraft(source as PresupuestoDetailData),
    };
  } catch (e) {
    return handleCodedServerActionError('presupuestos.duplicate', 'TC003', e);
  }
}
