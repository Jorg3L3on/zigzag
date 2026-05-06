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
    return { session: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const ticketRow = await db.query.ticket.findFirst({
    where: eq(ticket.id, ticketId),
  });

  if (!ticketRow) {
    return {
      session,
      response: NextResponse.json({ error: 'Ticket not found' }, { status: 404 }),
    };
  }

  if (
    !session.user.company_is_system &&
    ticketRow.company_id !== session.user.company_id
  ) {
    return { session, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session, response: null };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const ticketId = BigInt(id);
    const access = await ensureTicketAccess(ticketId);
    if (access.response) {
      return access.response;
    }

    const ticketServicesRows = await db.query.servicesTickets.findMany({
      where: eq(servicesTickets.ticket_id, ticketId),
      with: {
        service: true,
      },
    });

    return NextResponse.json(convertBigIntToString(ticketServicesRows));
  } catch (error) {
    console.error('Error fetching ticket services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket services' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const ticketId = BigInt(id);
    const access = await ensureTicketAccess(ticketId);
    if (access.response) {
      return access.response;
    }

    const body = await request.json();
    const parsed = z
      .object({
        service_id: z.number().int().positive(),
        quantity: z.number().int().positive(),
        price: z.number().nonnegative(),
      })
      .parse(body);

    const createdWithDetails = await db.transaction(async (tx) => {
      const [ticketService] = await tx
        .insert(servicesTickets)
        .values({
          service_id: parsed.service_id,
          ticket_id: ticketId,
          quantity: parsed.quantity,
          price: parsed.price,
        })
        .returning();

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
        where: eq(servicesTickets.id, ticketService.id),
        with: { service: true },
      });
    });

    return NextResponse.json(convertBigIntToString(createdWithDetails));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Invalid payload' },
        { status: 400 },
      );
    }
    console.error('Error adding service to ticket:', error);
    return NextResponse.json(
      { error: 'Failed to add service to ticket' },
      { status: 500 },
    );
  }
}
