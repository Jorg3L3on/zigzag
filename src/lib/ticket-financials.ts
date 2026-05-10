import { eq } from 'drizzle-orm';
import { servicesTickets, ticket } from '@/db/schema';
import { db } from '@/lib/db';

type FinancialLine = {
  quantity: number;
  price: number;
};

type TicketMutationExecutor = {
  select: typeof db.select;
  update: typeof db.update;
};

export const calculateTicketTotal = (lines: FinancialLine[]): number =>
  lines.reduce((sum, line) => sum + line.quantity * line.price, 0);

export async function syncTicketTotal(
  executor: TicketMutationExecutor,
  ticketId: bigint,
): Promise<number> {
  const allForTicket = await executor
    .select()
    .from(servicesTickets)
    .where(eq(servicesTickets.ticket_id, ticketId));

  const total = calculateTicketTotal(allForTicket);
  await executor.update(ticket).set({ total }).where(eq(ticket.id, ticketId));
  return total;
}
