import { and, eq, inArray, isNull } from 'drizzle-orm';
import { service, servicesTickets } from '@/db/schema';
import type { db } from '@/lib/db';
import { AuthorizationError } from '@/lib/errors';
import { roundMoney } from '@/lib/money';
import {
  isCustomServiceLine,
  serviceLineInputSchema,
  type ParsedServiceLine,
  type ServiceLineInput,
} from '@/lib/ticket-service-line-schema';

/** A Drizzle transaction (or the db itself) that can read and insert. */
export type ServiceLineExecutor = Pick<typeof db, 'insert'>;

export type ServicesTicketsInsert = typeof servicesTickets.$inferInsert;
export type ServicesTicketsRowInserted = typeof servicesTickets.$inferSelect;

export const parseServiceLines = (
  lines: ServiceLineInput[],
): ParsedServiceLine[] =>
  lines.map((line) => serviceLineInputSchema.parse(line));

export const catalogServiceIds = (lines: ParsedServiceLine[]): number[] =>
  Array.from(
    new Set(
      lines.flatMap((line) =>
        isCustomServiceLine(line) ? [] : [line.service_id],
      ),
    ),
  );

/** Every catalog line must reference an active Service of this company. */
export async function assertCatalogServicesBelongToCompany(
  executor: Pick<typeof db, 'select'>,
  serviceIds: number[],
  companyId: number,
): Promise<void> {
  const unique = Array.from(new Set(serviceIds));
  if (unique.length === 0) return;
  const rows = await executor
    .select({ id: service.id })
    .from(service)
    .where(
      and(
        inArray(service.id, unique),
        eq(service.company_id, companyId),
        isNull(service.deleted_at),
      ),
    );
  if (rows.length !== unique.length) {
    throw new AuthorizationError('One or more services are unavailable');
  }
}

/**
 * Turns parsed lines into ServicesTickets values inside the caller's transaction.
 * Callers check catalog ownership first (assertCatalogServicesBelongToCompany).
 * Inline lines with `save_to_catalog` first create their Service (same tx, so a
 * later failure rolls both back); the line then points at it like any catalog line.
 */
export async function buildServiceLineValues(
  tx: ServiceLineExecutor,
  input: {
    companyId: number;
    ticketId: bigint;
    lines: ParsedServiceLine[];
  },
): Promise<{
  values: ServicesTicketsInsert[];
  createdServiceIds: number[];
}> {
  const values: ServicesTicketsInsert[] = [];
  const createdServiceIds: number[] = [];

  for (const line of input.lines) {
    const price = roundMoney(line.price);
    if (!isCustomServiceLine(line)) {
      values.push({
        ticket_id: input.ticketId,
        service_id: line.service_id,
        quantity: line.quantity,
        price,
      });
      continue;
    }

    if (line.save_to_catalog) {
      const [created] = await tx
        .insert(service)
        .values({
          company_id: input.companyId,
          name: line.name,
          // Catalog descriptions are required; fall back to the name.
          description: line.description ?? line.name,
          price,
        })
        .returning({ id: service.id });
      createdServiceIds.push(created.id);
      values.push({
        ticket_id: input.ticketId,
        service_id: created.id,
        quantity: line.quantity,
        price,
      });
      continue;
    }

    values.push({
      ticket_id: input.ticketId,
      service_id: null,
      name: line.name,
      description: line.description ?? null,
      quantity: line.quantity,
      price,
    });
  }

  return { values, createdServiceIds };
}

/** buildServiceLineValues + insert. Returns the inserted rows. */
export async function insertServiceLines(
  tx: ServiceLineExecutor,
  input: {
    companyId: number;
    ticketId: bigint;
    lines: ParsedServiceLine[];
  },
): Promise<{
  rows: ServicesTicketsRowInserted[];
  createdServiceIds: number[];
}> {
  const { values, createdServiceIds } = await buildServiceLineValues(tx, input);
  if (values.length === 0) {
    return { rows: [], createdServiceIds };
  }
  const rows = await tx.insert(servicesTickets).values(values).returning();
  return { rows, createdServiceIds };
}

/** Copies existing lines (catalog or inline) onto another ticket, verbatim. */
export const copyServiceLineValues = (
  lines: Array<
    Pick<
      ServicesTicketsRowInserted,
      'service_id' | 'name' | 'description' | 'quantity' | 'price'
    >
  >,
  ticketId: bigint,
): ServicesTicketsInsert[] =>
  lines.map((line) => ({
    ticket_id: ticketId,
    service_id: line.service_id,
    name: line.name,
    description: line.description,
    quantity: line.quantity,
    price: line.price,
  }));
