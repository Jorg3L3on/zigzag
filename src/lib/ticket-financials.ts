import { and, eq, isNull } from 'drizzle-orm';
import { servicesTickets, ticket, ticketLineMaterial } from '@/db/schema';
import { db } from '@/lib/db';
import { addMoney, sumLineTotals, sumMaterialTotals } from '@/lib/money';

type FinancialLine = {
  quantity: number;
  price: number;
  /** Materials under the line add on top of quantity × price (ZIG-I10). */
  materials?: ReadonlyArray<{ quantity: number; price: number }> | null;
};

type TicketMutationExecutor = {
  select: typeof db.select;
  update: typeof db.update;
};

export const calculateTicketTotal = (lines: FinancialLine[]): number =>
  addMoney(
    sumLineTotals(lines),
    ...lines.map((line) => sumMaterialTotals(line.materials)),
  );

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

  // Active materials of active lines only.
  const materials = await executor
    .select({
      quantity: ticketLineMaterial.quantity,
      price: ticketLineMaterial.price,
    })
    .from(ticketLineMaterial)
    .innerJoin(
      servicesTickets,
      eq(ticketLineMaterial.services_tickets_id, servicesTickets.id),
    )
    .where(
      and(
        eq(servicesTickets.ticket_id, ticketId),
        isNull(servicesTickets.deleted_at),
        isNull(ticketLineMaterial.deleted_at),
      ),
    );

  const total = addMoney(sumLineTotals(allForTicket), sumMaterialTotals(materials));
  await executor.update(ticket).set({ total }).where(eq(ticket.id, ticketId));
  return total;
}
