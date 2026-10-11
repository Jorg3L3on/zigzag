'use server';

import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { client, ticket, ticketPayment } from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  requireActionAuth,
  requireActionPermission,
  requireTenantActionPermission,
} from '@/lib/security';
import { recordResourceAudit } from '@/lib/resource-audit';
import {
  CLIENT_NOTES_MAX_LENGTH,
  normalizeClientNotes,
  summarizeClientBalance,
  type ClientBalanceSummary,
} from '@/lib/client-detail';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import {
  getPresupuestoStatus,
  isPresupuestoTicket,
  PRESUPUESTO_STATUS_LABEL,
  type PresupuestoStatus,
} from '@/lib/ticket-document-kind';
import {
  listClientServiceSchedulesForClient,
  type ClientServiceScheduleListItem,
} from '@/actions/client-service-schedules';
import { formatDocumentFolio } from '@/lib/folio';
import type { Client } from '@/actions/clients';

export type ClientDetailTicket = {
  id: string;
  folio: string;
  ticketDate: string | null;
  createdAt: string;
  workNotes: string | null;
  total: number;
  paid: number;
  balanceDue: number;
  finished: boolean;
  paymentStatus: TicketPaymentStatus;
};

export type ClientDetailPresupuesto = {
  id: string;
  folio: string;
  ticketDate: string | null;
  expiresAt: string | null;
  total: number;
  status: PresupuestoStatus;
  statusLabel: string;
  convertedToTicketId: string | null;
};

export type ClientDetailPayment = {
  id: number;
  ticketId: string;
  ticketFolio: string;
  amount: number;
  createdAt: string;
};

export type ClientDetailData = {
  client: Client;
  balance: ClientBalanceSummary;
  tickets: ClientDetailTicket[];
  presupuestos: ClientDetailPresupuesto[];
  payments: ClientDetailPayment[];
  schedules: ClientServiceScheduleListItem[];
};

const iso = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

/** History of one client: tickets, presupuestos, payments, reminders and balance. */
export async function getClientDetail(id: number): Promise<{
  success: boolean;
  data?: ClientDetailData;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const context = await requireActionAuth();
    const { companyId } = await requireActionPermission(
      'clients.read',
      context.companyIsSystem ? undefined : context.companyId,
    );
    // Documents and payments need ticket access on top of client access.
    await requireActionPermission(
      'tickets.read',
      context.companyIsSystem ? undefined : context.companyId,
    );

    const [row] = await db
      .select()
      .from(client)
      .where(
        context.companyIsSystem
          ? and(eq(client.id, id), isNull(client.deleted_at))
          : and(
              eq(client.id, id),
              eq(client.company_id, companyId),
              isNull(client.deleted_at),
            ),
      )
      .limit(1);
    if (!row) {
      return buildActionError('CL006');
    }

    // Scope everything below to the company that owns the client.
    const ownerCompanyId = row.company_id ?? companyId;
    const docs = await db
      .select()
      .from(ticket)
      .where(
        and(
          eq(ticket.client_id, id),
          eq(ticket.company_id, ownerCompanyId),
          isNull(ticket.deleted_at),
        ),
      )
      .orderBy(desc(ticket.created_at));

    const workTickets = docs.filter((d) => !isPresupuestoTicket(d.document_kind));
    const quotes = docs.filter((d) => isPresupuestoTicket(d.document_kind));

    const ticketIds = workTickets.map((t) => t.id);
    const paymentRows =
      ticketIds.length > 0
        ? await db
            .select()
            .from(ticketPayment)
            .where(
              and(
                inArray(ticketPayment.ticket_id, ticketIds),
                eq(ticketPayment.company_id, ownerCompanyId),
              ),
            )
            .orderBy(desc(ticketPayment.created_at))
            .limit(200)
        : [];

    const folioByTicketId = new Map(workTickets.map((t) => [t.id, formatDocumentFolio(t)]));
    const schedulesResult = await listClientServiceSchedulesForClient(
      id,
      ownerCompanyId,
    );

    return {
      success: true,
      data: {
        client: row,
        balance: summarizeClientBalance(workTickets),
        tickets: workTickets.map((t) => ({
          id: String(t.id),
          folio: formatDocumentFolio(t),
          ticketDate: iso(t.ticket_date),
          createdAt: t.created_at.toISOString(),
          workNotes: t.work_notes,
          total: t.total ?? 0,
          paid: t.paid ?? 0,
          balanceDue: getTicketBalanceDue(t.total, t.paid),
          finished: t.finished,
          paymentStatus: getTicketPaymentStatus(t.total, t.paid),
        })),
        presupuestos: quotes.map((q) => {
          const status = getPresupuestoStatus(q);
          return {
            id: String(q.id),
            folio: formatDocumentFolio(q),
            ticketDate: iso(q.ticket_date),
            expiresAt: iso(q.expires_at),
            total: q.total ?? 0,
            status,
            statusLabel: PRESUPUESTO_STATUS_LABEL[status],
            convertedToTicketId:
              q.converted_to_ticket_id != null
                ? String(q.converted_to_ticket_id)
                : null,
          };
        }),
        payments: paymentRows.map((p) => ({
          id: p.id,
          ticketId: String(p.ticket_id),
          ticketFolio: folioByTicketId.get(p.ticket_id) ?? `#${p.ticket_id}`,
          amount: p.amount ?? 0,
          createdAt: p.created_at.toISOString(),
        })),
        schedules: schedulesResult.success ? (schedulesResult.data ?? []) : [],
      },
    };
  } catch (error) {
    return handleCodedServerActionError('clients.detail', 'CL002', error);
  }
}

const notesSchema = z.object({
  id: z.number().int().positive(),
  notes: z.string().max(CLIENT_NOTES_MAX_LENGTH).nullable(),
});

/** Saves the free-text notes of a client (ZIG-I17-3). Empty text clears them. */
export async function updateClientNotes(
  id: number,
  notes: string | null,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: { notes: string | null };
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const parsed = notesSchema.safeParse({ id, notes });
    if (!parsed.success) {
      return buildActionError('CL004');
    }
    const { context, companyId: effectiveCompanyId } =
      await requireTenantActionPermission('clients.write', companyId ?? undefined);

    const existing = await db.query.client.findFirst({
      where: and(
        eq(client.id, id),
        eq(client.company_id, effectiveCompanyId),
        isNull(client.deleted_at),
      ),
    });
    if (!existing) {
      return buildActionError('CL006');
    }

    const nextNotes = normalizeClientNotes(parsed.data.notes);
    const [updated] = await db
      .update(client)
      .set({ notes: nextNotes, updated_at: new Date() })
      .where(
        and(
          eq(client.id, id),
          eq(client.company_id, effectiveCompanyId),
          isNull(client.deleted_at),
        ),
      )
      .returning();

    if (updated) {
      await recordResourceAudit(db, {
        actor: context,
        resourceType: 'client',
        resourceId: id,
        targetCompanyId: effectiveCompanyId,
        action: 'updated',
        before: existing,
        after: updated,
        source: 'action',
      });
    }

    revalidatePath(`/clients/${id}`);
    return { success: true, data: { notes: nextNotes } };
  } catch (error) {
    return handleCodedServerActionError('clients.notes', 'CL004', error);
  }
}
