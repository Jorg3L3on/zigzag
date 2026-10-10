import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { material, serviceMaterial } from '@/db/schema';
import type { db } from '@/lib/db';
import { roundMoney } from '@/lib/money';
import {
  findOrCreateMaterial,
  loadCatalogMaterials,
} from '@/lib/service-lines-server';
import type {
  ParsedServiceMaterial,
  ServiceMaterialView,
} from '@/lib/service-materials';

type Executor = Pick<typeof db, 'select' | 'insert' | 'update'>;

/**
 * Replaces the default materials of one catalog Service (ZIG-I10). Callers
 * check the Service belongs to the company. Catalog ids are company-checked
 * here; new names find or create the company Material. The price is stored as
 * an override only when it differs from the catalog price.
 */
export async function replaceServiceMaterials(
  tx: Executor,
  input: {
    companyId: number;
    serviceId: number;
    materials: ParsedServiceMaterial[];
  },
): Promise<{
  rows: Array<typeof serviceMaterial.$inferSelect>;
  createdMaterialIds: number[];
}> {
  const catalog = await loadCatalogMaterials(
    tx,
    input.materials.flatMap((item) => (item.material_id ? [item.material_id] : [])),
    input.companyId,
  );
  const createdMaterialIds: number[] = [];
  const values: Array<typeof serviceMaterial.$inferInsert> = [];
  const seen = new Set<number>();

  for (const item of input.materials) {
    const price = roundMoney(item.price);
    let linked = item.material_id ? catalog.get(item.material_id) : undefined;
    if (!linked) {
      const result = await findOrCreateMaterial(tx, {
        companyId: input.companyId,
        name: item.name,
        unit: item.unit,
        price,
      });
      linked = result.row;
      if (result.created) createdMaterialIds.push(linked.id);
    }
    // One row per material per service (unique index); the first one wins.
    if (seen.has(linked.id)) continue;
    seen.add(linked.id);
    values.push({
      service_id: input.serviceId,
      material_id: linked.id,
      quantity: roundMoney(item.quantity),
      price: price === roundMoney(linked.price) ? null : price,
      sort_order: values.length,
    });
  }

  await tx
    .update(serviceMaterial)
    .set({ deleted_at: new Date(), updated_at: new Date() })
    .where(
      and(
        eq(serviceMaterial.service_id, input.serviceId),
        isNull(serviceMaterial.deleted_at),
      ),
    );

  const rows =
    values.length > 0
      ? await tx.insert(serviceMaterial).values(values).returning()
      : [];
  return { rows, createdMaterialIds };
}

/**
 * Active default materials of these services, grouped by service id. Callers
 * pass service ids already scoped to the company; the Material join also
 * checks the company.
 */
export async function loadServiceMaterials(
  executor: Pick<typeof db, 'select'>,
  serviceIds: number[],
  companyId: number,
): Promise<Map<number, ServiceMaterialView[]>> {
  const byService = new Map<number, ServiceMaterialView[]>();
  const unique = Array.from(new Set(serviceIds));
  if (unique.length === 0) return byService;
  const rows = await executor
    .select({
      id: serviceMaterial.id,
      service_id: serviceMaterial.service_id,
      material_id: serviceMaterial.material_id,
      quantity: serviceMaterial.quantity,
      price: serviceMaterial.price,
      name: material.name,
      unit: material.unit,
      catalog_price: material.price,
    })
    .from(serviceMaterial)
    .innerJoin(material, eq(serviceMaterial.material_id, material.id))
    .where(
      and(
        inArray(serviceMaterial.service_id, unique),
        isNull(serviceMaterial.deleted_at),
        isNull(material.deleted_at),
        eq(material.company_id, companyId),
      ),
    )
    .orderBy(asc(serviceMaterial.sort_order), asc(serviceMaterial.id));

  for (const row of rows) {
    const list = byService.get(row.service_id) ?? [];
    list.push({
      id: row.id,
      material_id: row.material_id,
      name: row.name,
      unit: row.unit,
      quantity: Number(row.quantity),
      price: Number(row.price ?? row.catalog_price),
      catalog_price: Number(row.catalog_price),
    });
    byService.set(row.service_id, list);
  }
  return byService;
}
