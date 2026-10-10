import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  material,
  service,
  servicesTickets,
  ticketLineMaterial,
} from '@/db/schema';
import type { db } from '@/lib/db';
import { AuthorizationError } from '@/lib/errors';
import { roundMoney } from '@/lib/money';
import {
  isCustomMaterialLine,
  isCustomServiceLine,
  serviceLineInputSchema,
  type ParsedMaterialLine,
  type ParsedServiceLine,
  type ServiceLineInput,
} from '@/lib/ticket-service-line-schema';

/**
 * A Drizzle transaction (or the db itself) that can insert. Lines with
 * materials also need `select` (catalog snapshot and name dedupe).
 */
export type ServiceLineExecutor = Pick<typeof db, 'insert'> &
  Partial<Pick<typeof db, 'select'>>;

export type ServicesTicketsInsert = typeof servicesTickets.$inferInsert;
export type ServicesTicketsRowInserted = typeof servicesTickets.$inferSelect;
export type TicketLineMaterialInsert = typeof ticketLineMaterial.$inferInsert;
export type TicketLineMaterialRowInserted = typeof ticketLineMaterial.$inferSelect;

type CatalogMaterial = {
  id: number;
  name: string;
  unit: string | null;
  price: number;
};

const requireSelect = (executor: ServiceLineExecutor) => {
  if (!executor.select) {
    throw new Error('Material lines need an executor that can select');
  }
  return executor as Pick<typeof db, 'insert' | 'select'>;
};

/**
 * Active Materials of this company by id. Throws AuthorizationError when any id
 * is missing, deleted or belongs to another company (IDOR guard, ZIG-I10).
 */
export async function loadCatalogMaterials(
  executor: Pick<typeof db, 'select'>,
  materialIds: number[],
  companyId: number,
): Promise<Map<number, CatalogMaterial>> {
  const unique = Array.from(new Set(materialIds));
  const byId = new Map<number, CatalogMaterial>();
  if (unique.length === 0) return byId;
  const rows = await executor
    .select({
      id: material.id,
      name: material.name,
      unit: material.unit,
      price: material.price,
    })
    .from(material)
    .where(
      and(
        inArray(material.id, unique),
        eq(material.company_id, companyId),
        isNull(material.deleted_at),
      ),
    );
  if (rows.length !== unique.length) {
    throw new AuthorizationError('One or more materials are unavailable');
  }
  for (const row of rows) byId.set(row.id, row);
  return byId;
}

/**
 * Finds the company's active Material with this name (case-insensitive) or
 * creates it. Used by Guardar en mi catálogo and by the Servicios form.
 */
export async function findOrCreateMaterial(
  executor: Pick<typeof db, 'insert' | 'select'>,
  input: { companyId: number; name: string; unit: string | null; price: number },
): Promise<{ row: CatalogMaterial; created: boolean }> {
  const name = input.name.trim();
  const [existing] = await executor
    .select({
      id: material.id,
      name: material.name,
      unit: material.unit,
      price: material.price,
    })
    .from(material)
    .where(
      and(
        eq(material.company_id, input.companyId),
        isNull(material.deleted_at),
        sql`lower(${material.name}) = lower(${name})`,
      ),
    )
    .limit(1);
  if (existing) return { row: existing, created: false };
  const [created] = await executor
    .insert(material)
    .values({
      company_id: input.companyId,
      name,
      unit: input.unit,
      price: roundMoney(input.price),
    })
    .returning({
      id: material.id,
      name: material.name,
      unit: material.unit,
      price: material.price,
    });
  return { row: created, created: true };
}

export const catalogMaterialIds = (
  materials: ReadonlyArray<ParsedMaterialLine>,
): number[] =>
  Array.from(
    new Set(
      materials.flatMap((item) =>
        isCustomMaterialLine(item) ? [] : [item.material_id],
      ),
    ),
  );

/**
 * Turns parsed materials into TicketLineMaterial values for one saved line.
 * Catalog materials snapshot the catalog name and unit (the price is the one the
 * user set on the line). Inline materials with `save_to_catalog` first find or
 * create the company Material and then link to it.
 */
export async function buildLineMaterialValues(
  executor: ServiceLineExecutor,
  input: {
    companyId: number;
    servicesTicketsId: number;
    materials: ReadonlyArray<ParsedMaterialLine>;
  },
): Promise<{
  values: TicketLineMaterialInsert[];
  createdMaterialIds: number[];
}> {
  const values: TicketLineMaterialInsert[] = [];
  const createdMaterialIds: number[] = [];
  if (input.materials.length === 0) return { values, createdMaterialIds };

  const tx = requireSelect(executor);
  const catalog = await loadCatalogMaterials(
    tx,
    catalogMaterialIds(input.materials),
    input.companyId,
  );

  for (const [index, item] of input.materials.entries()) {
    const price = roundMoney(item.price);
    const quantity = roundMoney(item.quantity);
    if (!isCustomMaterialLine(item)) {
      const row = catalog.get(item.material_id)!;
      values.push({
        services_tickets_id: input.servicesTicketsId,
        material_id: row.id,
        name: row.name,
        unit: row.unit,
        quantity,
        price,
        sort_order: index,
      });
      continue;
    }
    if (item.save_to_catalog) {
      const { row, created } = await findOrCreateMaterial(tx, {
        companyId: input.companyId,
        name: item.name,
        unit: item.unit,
        price,
      });
      if (created) createdMaterialIds.push(row.id);
      values.push({
        services_tickets_id: input.servicesTicketsId,
        material_id: row.id,
        name: item.name,
        unit: item.unit,
        quantity,
        price,
        sort_order: index,
      });
      continue;
    }
    values.push({
      services_tickets_id: input.servicesTicketsId,
      material_id: null,
      name: item.name,
      unit: item.unit,
      quantity,
      price,
      sort_order: index,
    });
  }
  return { values, createdMaterialIds };
}

/** buildLineMaterialValues + insert. Returns the inserted rows. */
export async function insertLineMaterials(
  executor: ServiceLineExecutor,
  input: {
    companyId: number;
    servicesTicketsId: number;
    materials: ReadonlyArray<ParsedMaterialLine>;
  },
): Promise<{
  rows: TicketLineMaterialRowInserted[];
  createdMaterialIds: number[];
}> {
  const { values, createdMaterialIds } = await buildLineMaterialValues(
    executor,
    input,
  );
  if (values.length === 0) return { rows: [], createdMaterialIds };
  const rows = await executor
    .insert(ticketLineMaterial)
    .values(values)
    .returning();
  return { rows, createdMaterialIds };
}

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

export type InsertedServiceLine = ServicesTicketsRowInserted & {
  materials: TicketLineMaterialRowInserted[];
};

/**
 * buildServiceLineValues + insert, then each line's materials (ZIG-I10).
 * Returns the inserted rows with their materials.
 */
export async function insertServiceLines(
  tx: ServiceLineExecutor,
  input: {
    companyId: number;
    ticketId: bigint;
    lines: ParsedServiceLine[];
  },
): Promise<{
  rows: InsertedServiceLine[];
  createdServiceIds: number[];
  createdMaterialIds: number[];
}> {
  const { values, createdServiceIds } = await buildServiceLineValues(tx, input);
  const createdMaterialIds: number[] = [];
  if (values.length === 0) {
    return { rows: [], createdServiceIds, createdMaterialIds };
  }
  const hasMaterials = input.lines.some((line) => line.materials.length > 0);
  if (!hasMaterials) {
    const inserted = await tx.insert(servicesTickets).values(values).returning();
    return {
      rows: inserted.map((row) => ({ ...row, materials: [] })),
      createdServiceIds,
      createdMaterialIds,
    };
  }
  // One insert per line so each material set lands on its own line id
  // (RETURNING order of a multi-row insert is not a documented guarantee).
  const rows: InsertedServiceLine[] = [];
  for (const [index, value] of values.entries()) {
    const [row] = await tx.insert(servicesTickets).values(value).returning();
    const result = await insertLineMaterials(tx, {
      companyId: input.companyId,
      servicesTicketsId: row.id,
      materials: input.lines[index].materials,
    });
    createdMaterialIds.push(...result.createdMaterialIds);
    rows.push({ ...row, materials: result.rows });
  }
  return { rows, createdServiceIds, createdMaterialIds };
}

/** Copies material rows onto a new line, verbatim (presupuesto → ticket). */
export const copyLineMaterialValues = (
  materials: ReadonlyArray<
    Pick<
      TicketLineMaterialRowInserted,
      'material_id' | 'name' | 'unit' | 'quantity' | 'price' | 'sort_order'
    >
  >,
  servicesTicketsId: number,
): TicketLineMaterialInsert[] =>
  materials.map((item) => ({
    services_tickets_id: servicesTicketsId,
    material_id: item.material_id,
    name: item.name,
    unit: item.unit,
    quantity: item.quantity,
    price: item.price,
    sort_order: item.sort_order,
  }));

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
