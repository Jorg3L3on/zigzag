import { and, eq, isNull } from 'drizzle-orm';
import { service, servicesTickets, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import { syncTicketTotal } from '@/lib/ticket-financials';
import { z } from 'zod';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import { recordTicketAudit } from '@/lib/ticket-audit';

async function ensureTicketAccess(
  ticketId: bigint,
  permissionName: string,
  method: string,
) {
  const ticketRow = await db.query.ticket.findFirst({
    where: and(eq(ticket.id, ticketId), isNull(ticket.deleted_at)),
  });

  if (!ticketRow) {
    return { response: fail('TC008', 404, 'validation') };
  }

  const { session, unauthorized } = await requireApiPermission(
    permissionName,
    ticketRow.company_id,
    {
      route: `/api/tickets/${ticketId.toString()}/services/[serviceId]`,
      method,
    },
  );
  if (unauthorized || !session) {
    return { session, ticket: ticketRow, response: unauthorized };
  }

  if (
    !session.user.company_is_system &&
    ticketRow.company_id !== session.user.company_id
  ) {
    return { session, ticket: ticketRow, response: fail('AU002', 403, 'auth') };
  }

  return { session, ticket: ticketRow, response: null };
}

const buildAuditContext = (session: NonNullable<Awaited<ReturnType<typeof requireApiPermission>>['session']>) => ({
  userId: session.user.id,
  companyId: session.user.company_id ?? null,
  companyIsSystem: Boolean(session.user.company_is_system),
});

const serviceTicketSnapshot = (
  row:
    | ((typeof servicesTickets.$inferSelect) & {
        service?: typeof service.$inferSelect | null;
      })
    | null
    | undefined,
) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    ticket_id: row.ticket_id,
    service_id: row.service_id,
    service_name: row.service?.name ?? null,
    quantity: row.quantity,
    price: row.price,
    line_total: row.quantity * row.price,
    deleted_at: row.deleted_at,
  };
};

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; serviceId: string }> },
) {
  try {
    const params = await context.params;
    const ticketId = BigInt(params.id);
    const serviceTicketId = Number.parseInt(params.serviceId, 10);
    if (Number.isNaN(serviceTicketId)) {
      return fail('TS003', 400, 'validation');
    }

    const access = await ensureTicketAccess(ticketId, 'tickets.write', 'PUT');
    if (access.response) {
      return access.response;
    }

    const body = await request.json();
    const parsed = z
      .object({
        quantity: z.number().int().positive(),
        price: z.number().nonnegative(),
      })
      .parse(body);

    const ticketTotalBefore = access.ticket.total ?? null;
    const full = await db.transaction(async (tx) => {
      const before = await tx.query.servicesTickets.findFirst({
        where: and(
          eq(servicesTickets.id, serviceTicketId),
          eq(servicesTickets.ticket_id, ticketId),
          isNull(servicesTickets.deleted_at),
        ),
        with: { service: true },
      });

      if (!before) {
        return null;
      }

      const [updated] = await tx
        .update(servicesTickets)
        .set({
          quantity: parsed.quantity,
          price: parsed.price,
          updated_at: new Date(),
        })
        .where(
          and(
            eq(servicesTickets.id, serviceTicketId),
            eq(servicesTickets.ticket_id, ticketId),
            isNull(servicesTickets.deleted_at),
          ),
        )
        .returning();

      if (!updated) {
        return null;
      }

      const ticketTotalAfter = await syncTicketTotal(tx, ticketId);

      const after = await tx.query.servicesTickets.findFirst({
        where: and(
          eq(servicesTickets.id, serviceTicketId),
          isNull(servicesTickets.deleted_at),
        ),
        with: { service: true },
      });

      await recordTicketAudit(tx, buildAuditContext(access.session), ticketId, access.ticket.company_id, 'updated', {
        ticket: {
          id: ticketId,
          company_id: access.ticket.company_id,
        },
        source: 'api',
        mutation: 'ticket_service_updated',
        ticket_service: {
          before: serviceTicketSnapshot(before),
          after: serviceTicketSnapshot(after),
        },
        ticket_total: {
          before: ticketTotalBefore,
          after: ticketTotalAfter,
          delta:
            ticketTotalBefore === null
              ? null
              : ticketTotalAfter - ticketTotalBefore,
        },
      });

      return after;
    });

    if (!full) {
      return fail('TS005', 404, 'validation');
    }

    return ok(full);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('TS003', 400, 'validation');
    }
    console.error('Error updating ticket service:', error);
    return fail('TS003', 500, 'server');
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; serviceId: string }> },
) {
  try {
    const params = await context.params;
    const ticketId = BigInt(params.id);
    const serviceTicketId = Number.parseInt(params.serviceId, 10);
    if (Number.isNaN(serviceTicketId)) {
      return fail('TS004', 400, 'validation');
    }

    const access = await ensureTicketAccess(ticketId, 'tickets.write', 'DELETE');
    if (access.response) {
      return access.response;
    }

    const ticketTotalBefore = access.ticket.total ?? null;
    const deleted = await db.transaction(async (tx) => {
      const before = await tx.query.servicesTickets.findFirst({
        where: and(
          eq(servicesTickets.id, serviceTicketId),
          eq(servicesTickets.ticket_id, ticketId),
          isNull(servicesTickets.deleted_at),
        ),
        with: { service: true },
      });

      if (!before) {
        return null;
      }

      const [deletedRow] = await tx
        .update(servicesTickets)
        .set({ deleted_at: new Date(), updated_at: new Date() })
        .where(
          and(
            eq(servicesTickets.id, serviceTicketId),
            eq(servicesTickets.ticket_id, ticketId),
            isNull(servicesTickets.deleted_at),
          ),
        )
        .returning();

      if (!deletedRow) {
        return null;
      }

      const ticketTotalAfter = await syncTicketTotal(tx, ticketId);
      const after = {
        ...before,
        deleted_at: deletedRow.deleted_at,
      };

      await recordTicketAudit(tx, buildAuditContext(access.session), ticketId, access.ticket.company_id, 'updated', {
        ticket: {
          id: ticketId,
          company_id: access.ticket.company_id,
        },
        source: 'api',
        mutation: 'ticket_service_removed',
        ticket_service: {
          before: serviceTicketSnapshot(before),
          after: serviceTicketSnapshot(after),
        },
        ticket_total: {
          before: ticketTotalBefore,
          after: ticketTotalAfter,
          delta:
            ticketTotalBefore === null
              ? null
              : ticketTotalAfter - ticketTotalBefore,
        },
      });

      return deletedRow;
    });

    if (!deleted) {
      return fail('TS005', 404, 'validation');
    }

    return ok({ deleted: true });
  } catch (error) {
    console.error('Error deleting ticket service:', error);
    return fail('TS004', 500, 'server');
  }
}
