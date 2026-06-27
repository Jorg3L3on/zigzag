import { and, eq, isNull } from 'drizzle-orm';
import { servicesTickets, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import { sumLineTotals } from '@/lib/money';

type FinancialLine = {
  quantity: number;
  price: number;
};

type TicketMutationExecutor = {
  select: typeof db.select;
  update: typeof db.update;
};

export const calculateTicketTotal = (lines: FinancialLine[]): number =>
  sumLineTotals(lines);

export async function syncTicketTotal(
  executor: TicketMutationExecutor,
  ticketId: bigint,
): Promise<number> {
  const allForTicket = await executor
    .select()
    .from(servicesTickets)
    .where(
      and(
        eq(servicesTickets.ticket_id, ticketId),
        isNull(servicesTickets.deleted_at),
      ),
    );

  const total = calculateTicketTotal(allForTicket);
  await executor.update(ticket).set({ total }).where(eq(ticket.id, ticketId));
  return total;
}
