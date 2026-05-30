import { and, eq, isNull } from 'drizzle-orm';
import { servicesTickets, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import { syncTicketTotal } from '@/lib/ticket-financials';
import { z } from 'zod';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';

async function ensureTicketAccess(ticketId: bigint, permissionName: string) {
  const ticketRow = await db.query.ticket.findFirst({
    where: and(eq(ticket.id, ticketId), isNull(ticket.deleted_at)),
  });

  if (!ticketRow) {
    return { response: fail('TC008', 404, 'validation') };
  }

  const { session, unauthorized } = await requireApiPermission(
    permissionName,
    ticketRow.company_id,
  );
  if (unauthorized || !session) {
    return { response: unauthorized };
  }

  if (
    !session.user.company_is_system &&
    ticketRow.company_id !== session.user.company_id
  ) {
    return { response: fail('AU002', 403, 'auth') };
  }

  return { response: null };
}

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

    const access = await ensureTicketAccess(ticketId, 'tickets.write');
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

    const full = await db.transaction(async (tx) => {
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

      await syncTicketTotal(tx, ticketId);

      return tx.query.servicesTickets.findFirst({
        where: and(
          eq(servicesTickets.id, serviceTicketId),
          isNull(servicesTickets.deleted_at),
        ),
        with: { service: true },
      });
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

    const access = await ensureTicketAccess(ticketId, 'tickets.write');
    if (access.response) {
      return access.response;
    }

    const deleted = await db.transaction(async (tx) => {
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

      await syncTicketTotal(tx, ticketId);
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
