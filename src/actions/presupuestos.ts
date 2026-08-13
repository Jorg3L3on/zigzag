'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  servicesTickets,
  ticket,
  type TicketRow,
} from '@/db/schema';
import { db } from '@/lib/db';
import {
  AuthorizationError,
  buildActionError,
  handleCodedServerActionError,
  handleServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  assertCompanyProductionReady,
  CompanyProductionBlockedError,
} from '@/lib/company-production-guard';
import { invalidateCompanyCache } from '@/lib/cache';
import { recordTicketAudit } from '@/lib/ticket-audit';
import { calculateTicketTotal } from '@/lib/ticket-financials';
import { requireTicketRead, requireTicketWrite } from '@/lib/tickets-rbac-server';
import {
  getPresupuestoStatus,
  isPresupuestoMutable,
  isPresupuestoTicket,
  PRESUPUESTO_STATUS_LABEL,
  type PresupuestoStatus,
} from '@/lib/ticket-document-kind';
import { client, service } from '@/db/schema';

const serviceLineSchema = z.object({
  service_id: z.number(),
  quantity: z.number().finite().min(1),
  price: z.number().finite().min(0),
});

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
  company_id: z.number(),
  services: z.array(serviceLineSchema).optional(),
});

export type CreatePresupuestoInput = z.infer<typeof presupuestoSchema>;

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

export async function createPresupuesto(
  data: CreatePresupuestoInput,
): Promise<{
  success: boolean;
  data?: PresupuestoListItem;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const validated = presupuestoSchema.parse(data);
    const { context, companyId: effectiveCompanyId } = await requireTicketWrite(
      validated.company_id,
    );

    await assertCompanyProductionReady(effectiveCompanyId);
    await assertClientBelongsToCompany(validated.client_id, effectiveCompanyId);
    if (validated.services?.length) {
      await assertServicesBelongToCompany(
        validated.services.map((line) => line.service_id),
        effectiveCompanyId,
      );
    }

    const total = validated.services?.length
      ? calculateTicketTotal(validated.services)
      : 0;

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(ticket)
        .values({
          client_id: validated.client_id,
          client_name: validated.client_name,
          client_tel: validated.client_tel,
          email: validated.email,
          document: validated.document,
          ticket_date: validated.ticket_date,
          expires_at: validated.expires_at ?? null,
          company_id: effectiveCompanyId,
          userId: BigInt(context.userId),
          document_kind: 'presupuesto',
          finished: false,
          paid: 0,
          total,
        })
        .returning();

      if (validated.services?.length) {
        await tx.insert(servicesTickets).values(
          validated.services.map((line) => ({
            service_id: line.service_id,
            ticket_id: row.id,
            quantity: line.quantity,
            price: line.price,
          })),
        );
      }

      await recordTicketAudit(tx, context, row.id, row.company_id, 'created', {
        ticket: row,
        document_kind: 'presupuesto',
      });

      return row;
    });

    invalidateCompanyCache(effectiveCompanyId, 'dashboard');
    return { success: true, data: toListItem(created) };
  } catch (error) {
    if (error instanceof CompanyProductionBlockedError) {
      return handleServerActionError(error);
    }
    if (error instanceof z.ZodError) {
      return handleCodedServerActionError(
        'presupuestos.create.validation',
        'TC009',
        error,
      );
    }
    return handleCodedServerActionError('presupuestos.create', 'TC001', error);
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

    const servicesToSync = Array.isArray(data.services) ? data.services : null;
    if (servicesToSync) {
      z.array(serviceLineSchema).parse(servicesToSync);
      await assertServicesBelongToCompany(
        servicesToSync.map((line) => line.service_id),
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
          await tx.insert(servicesTickets).values(
            servicesToSync.map((line) => ({
              service_id: line.service_id,
              ticket_id: ticketId,
              quantity: line.quantity,
              price: line.price,
            })),
          );
        }
      }

      const totalFromServices = servicesToSync
        ? calculateTicketTotal(servicesToSync)
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
      return handleCodedServerActionError(
        'presupuestos.update.validation',
        'TC009',
        e,
      );
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
      if (activeLines.length > 0) {
        await tx.insert(servicesTickets).values(
          activeLines.map((line) => ({
            service_id: line.service_id,
            ticket_id: workTicket.id,
            quantity: line.quantity,
            price: line.price,
          })),
        );
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
