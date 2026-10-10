import { asc, isNull } from 'drizzle-orm';
import { ticketLineMaterial, type TicketLineMaterialRow } from '@/db/schema';

/**
 * Drizzle `with` fragment for a ServicesTickets query: the line's active
 * materials in the order the user left them (ZIG-I10).
 */
export const activeLineMaterialsWith = {
  materials: {
    where: isNull(ticketLineMaterial.deleted_at),
    orderBy: [asc(ticketLineMaterial.sort_order), asc(ticketLineMaterial.id)],
  },
};

/** Lines read with `activeLineMaterialsWith` carry this; older fixtures may omit it. */
export type WithLineMaterials = { materials?: TicketLineMaterialRow[] };
