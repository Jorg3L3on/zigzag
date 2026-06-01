import { and, eq, isNull } from 'drizzle-orm';
import { service, servicesTickets, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import { syncTicketTotal } from '@/lib/ticket-financials';
import { z } from 'zod';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import { recordTicketAudit } from '@/lib/ticket-audit';

async function ensureTicketAccess(ticketId: bigint, permissionName: string) {
  const ticketRow = await db.query.ticket.findFirst({
    where: and(eq(ticket.id, ticketId), isNull(ticket.deleted_at)),
  });

  if (!ticketRow) {
    return {
      session: null,
      response: fail('TC008', 404, 'validation'),
    };
  }

  const { session, unauthorized } = await requireApiPermission(permissionName, ticketRow.company_id, {
    route: `/api/tickets/${ticketId.toString()}/services`,
    method: permissionName === 'tickets.read' ? 'GET' : 'POST',
  });
  if (unauthorized || !session) {
    return { session, response: unauthorized };
  }

  if (
    !session.user.company_is_system &&
    ticketRow.company_id !== session.user.company_id
  ) {
    return { session, response: fail('AU002', 403, 'auth') };
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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const ticketId = BigInt(id);
    const access = await ensureTicketAccess(ticketId, 'tickets.read');
    if (access.response) {
      return access.response;
    }

    const ticketServicesRows = await db.query.servicesTickets.findMany({
      where: and(
        eq(servicesTickets.ticket_id, ticketId),
        isNull(servicesTickets.deleted_at),
      ),
      with: {
        service: true,
      },
    });

    return ok(ticketServicesRows);
  } catch (error) {
    console.error('Error fetching ticket services:', error);
    return fail('TS001', 500, 'server');
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const ticketId = BigInt(id);
    const access = await ensureTicketAccess(ticketId, 'tickets.write');
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

    const serviceRow = await db.query.service.findFirst({
      where: and(
        eq(service.id, parsed.service_id),
        eq(service.company_id, access.ticket.company_id as number),
        isNull(service.deleted_at),
      ),
    });

    if (!serviceRow) {
      return fail('TS002', 404, 'validation');
    }

    const ticketTotalBefore = access.ticket.total ?? null;
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

      const ticketTotalAfter = await syncTicketTotal(tx, ticketId);
      const created = await tx.query.servicesTickets.findFirst({
        where: eq(servicesTickets.id, ticketService.id),
        with: { service: true },
      });

      await recordTicketAudit(tx, buildAuditContext(access.session), ticketId, access.ticket.company_id, 'updated', {
        ticket: {
          id: ticketId,
          company_id: access.ticket.company_id,
        },
        source: 'api',
        mutation: 'ticket_service_added',
        ticket_service: {
          before: null,
          after: serviceTicketSnapshot(created),
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

      return created;
    });

    return ok(createdWithDetails, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('TS002', 400, 'validation');
    }
    console.error('Error adding service to ticket:', error);
    return fail('TS002', 500, 'server');
  }
}
