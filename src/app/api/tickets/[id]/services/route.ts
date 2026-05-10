import { and, eq } from 'drizzle-orm';
import { servicesTickets, ticket } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { syncTicketTotal } from '@/lib/ticket-financials';
import { convertBigIntToString } from '@/lib/utils';
import { z } from 'zod';
import { fail, ok } from '@/lib/api-helpers';

async function ensureTicketAccess(ticketId: bigint) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      session: null,
      response: fail('Unauthorized', 401, 'auth'),
    };
  }

  const ticketRow = await db.query.ticket.findFirst({
    where: eq(ticket.id, ticketId),
  });

  if (!ticketRow) {
    return {
      session,
      response: fail('Ticket not found', 404, 'validation'),
    };
  }

  if (
    !session.user.company_is_system &&
    ticketRow.company_id !== session.user.company_id
  ) {
    return { session, response: fail('Forbidden', 403, 'auth') };
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

    return ok(convertBigIntToString(ticketServicesRows));
  } catch (error) {
    console.error('Error fetching ticket services:', error);
    return fail('Failed to fetch ticket services', 500, 'server');
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

      await syncTicketTotal(tx, ticketId);

      return tx.query.servicesTickets.findFirst({
        where: eq(servicesTickets.id, ticketService.id),
        with: { service: true },
      });
    });

    return ok(convertBigIntToString(createdWithDetails), 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(
        error.issues[0]?.message ?? 'Invalid payload',
        400,
        'validation',
      );
    }
    console.error('Error adding service to ticket:', error);
    return fail('Failed to add service to ticket', 500, 'server');
  }
}
