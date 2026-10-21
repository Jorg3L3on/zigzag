/**
 * Convertir a ticket (ZIG-I17-4): copies a mutable presupuesto into a new work
 * ticket with its own R folio, lines and materials, and links both. Shared by
 * the `convertPresupuestoToTicket` server action and MCP `convert_presupuesto`
 * (ZIG-I23-6). Callers authorize first and pass the actor.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { servicesTickets, ticket, ticketLineMaterial, type TicketRow } from '@/db/schema';
import { db } from '@/lib/db';
import type { ActionAuthContext } from '@/lib/authz-context';
import { allocateDocumentFolio } from '@/lib/folio-allocator';
import { activeLineMaterialsWith } from '@/lib/line-materials-query';
import { copyLineMaterialValues, copyServiceLineValues } from '@/lib/service-lines-server';
import { auditSourceArg } from '@/lib/documents/audit-source';
import { recordTicketAudit } from '@/lib/ticket-audit';
import { isPresupuestoMutable, isPresupuestoTicket } from '@/lib/ticket-document-kind';

/** The presupuesto does not exist in this company (or is not a presupuesto). */
export class PresupuestoNotFoundError extends Error {
  constructor() {
    super('Presupuesto not found');
    this.name = 'PresupuestoNotFoundError';
  }
}

/** Already converted or canceled. */
export class PresupuestoNotConvertibleError extends Error {
  constructor() {
    super('Presupuesto cannot be converted');
    this.name = 'PresupuestoNotConvertibleError';
  }
}

export async function convertPresupuesto(
  context: ActionAuthContext,
  input: {
    companyId: number;
    presupuestoId: bigint;
    audit?: { extra?: Record<string, unknown>; via?: 'action' | 'api' };
  },
): Promise<{ presupuesto: TicketRow; workTicket: TicketRow }> {
  const { companyId, presupuestoId: sourceId } = input;
  const extra = input.audit?.extra ?? {};
  const via = input.audit?.via;

  const source = await db.query.ticket.findFirst({
    where: and(eq(ticket.id, sourceId), eq(ticket.company_id, companyId), isNull(ticket.deleted_at)),
    with: {
      services_tickets: {
        where: isNull(servicesTickets.deleted_at),
        with: { ...activeLineMaterialsWith },
      },
    },
  });

  if (!source || !isPresupuestoTicket(source.document_kind)) {
    throw new PresupuestoNotFoundError();
  }
  if (!isPresupuestoMutable(source)) {
    throw new PresupuestoNotConvertibleError();
  }

  return db.transaction(async (tx) => {
    // The ticket gets its own R folio; the P folio stays on the presupuesto and is
    // reachable through converted_from_ticket_id (ZIG-I17-4).
    const folio = await allocateDocumentFolio(tx, { companyId, documentKind: 'ticket' });
    const [workTicket] = await tx
      .insert(ticket)
      .values({
        ...folio,
        client_id: source.client_id,
        client_name: source.client_name,
        client_tel: source.client_tel,
        email: source.email,
        document: source.document,
        ticket_date: source.ticket_date ?? new Date(),
        company_id: companyId,
        userId: BigInt(context.userId),
        document_kind: 'ticket',
        finished: false,
        paid: 0,
        total: source.total ?? 0,
        converted_from_ticket_id: sourceId,
      })
      .returning();

    // Catalog and inline lines (ZIG-I5) and their materials (ZIG-I10) are
    // copied verbatim. One insert per line keeps each material set on the
    // matching new line id.
    for (const line of source.services_tickets ?? []) {
      const [copied] = await tx
        .insert(servicesTickets)
        .values(copyServiceLineValues([line], workTicket.id))
        .returning({ id: servicesTickets.id });
      const lineMaterials = line.materials ?? [];
      if (lineMaterials.length > 0) {
        await tx.insert(ticketLineMaterial).values(copyLineMaterialValues(lineMaterials, copied.id));
      }
    }

    const [presupuesto] = await tx
      .update(ticket)
      .set({ converted_to_ticket_id: workTicket.id, updated_at: new Date() })
      .where(
        and(
          eq(ticket.id, sourceId),
          eq(ticket.company_id, companyId),
          isNull(ticket.deleted_at),
          isNull(ticket.converted_to_ticket_id),
          isNull(ticket.canceled_at),
        ),
      )
      .returning();

    if (!presupuesto) {
      throw new PresupuestoNotConvertibleError();
    }

    await recordTicketAudit(
      tx,
      context,
      sourceId,
      companyId,
      'presupuesto_converted',
      { sourcePresupuestoId: String(sourceId), targetTicketId: String(workTicket.id), ...extra },
      ...auditSourceArg(via),
    );

    await recordTicketAudit(
      tx,
      context,
      workTicket.id,
      companyId,
      'created',
      { ticket: workTicket, converted_from_presupuesto_id: String(sourceId), ...extra },
      ...auditSourceArg(via),
    );

    return { presupuesto, workTicket };
  });
}
