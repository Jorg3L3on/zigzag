import { and, eq } from 'drizzle-orm';
import { servicesTickets, ticket } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { convertBigIntToString } from '@/lib/utils';
import { NextResponse } from 'next/server';
import { z } from 'zod';

async function ensureTicketAccess(ticketId: bigint) {
  const session = await auth();
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const ticketRow = await db.query.ticket.findFirst({
    where: eq(ticket.id, ticketId),
  });

  if (!ticketRow) {
    return { response: NextResponse.json({ error: 'Ticket not found' }, { status: 404 }) };
  }

  if (
    !session.user.company_is_system &&
    ticketRow.company_id !== session.user.company_id
  ) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
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
      return NextResponse.json({ error: 'Invalid service id' }, { status: 400 });
    }

    const access = await ensureTicketAccess(ticketId);
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
        })
        .where(
          and(
            eq(servicesTickets.id, serviceTicketId),
            eq(servicesTickets.ticket_id, ticketId),
          ),
        )
        .returning();

      if (!updated) {
        return null;
      }

      const allForTicket = await tx
        .select()
        .from(servicesTickets)
        .where(eq(servicesTickets.ticket_id, ticketId));

      const total = allForTicket.reduce(
        (sum, row) => sum + row.quantity * row.price,
        0,
      );

      await tx.update(ticket).set({ total }).where(eq(ticket.id, ticketId));

      return tx.query.servicesTickets.findFirst({
        where: eq(servicesTickets.id, serviceTicketId),
        with: { service: true },
      });
    });

    if (!full) {
      return NextResponse.json(
        { error: 'Ticket service not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(convertBigIntToString(full));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Invalid payload' },
        { status: 400 },
      );
    }
    console.error('Error updating ticket service:', error);
    return NextResponse.json(
      { error: 'Failed to update ticket service' },
      { status: 500 },
    );
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
      return NextResponse.json({ error: 'Invalid service id' }, { status: 400 });
    }

    const access = await ensureTicketAccess(ticketId);
    if (access.response) {
      return access.response;
    }

    const deleted = await db.transaction(async (tx) => {
      const [deletedRow] = await tx
        .delete(servicesTickets)
        .where(
          and(
            eq(servicesTickets.id, serviceTicketId),
            eq(servicesTickets.ticket_id, ticketId),
          ),
        )
        .returning();

      if (!deletedRow) {
        return null;
      }

      const allForTicket = await tx
        .select()
        .from(servicesTickets)
        .where(eq(servicesTickets.ticket_id, ticketId));

      const total = allForTicket.reduce(
        (sum, row) => sum + row.quantity * row.price,
        0,
      );

      await tx.update(ticket).set({ total }).where(eq(ticket.id, ticketId));
      return deletedRow;
    });

    if (!deleted) {
      return NextResponse.json(
        { error: 'Ticket service not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ticket service:', error);
    return NextResponse.json(
      { error: 'Failed to delete ticket service' },
      { status: 500 },
    );
  }
}
