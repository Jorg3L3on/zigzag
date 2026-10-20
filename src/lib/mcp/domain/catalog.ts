import { and, asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { material, service, serviceMaterial } from '@/db/schema';
import { db } from '@/lib/db';
import { afterCursor, clampListLimit, toLikePattern, toPage } from '@/lib/mcp/cursor';
import type { AgentContext } from '@/lib/server/resolve-agent-context';

/** Catalog reads for the MCP connector (ZIG-I23-4): services and materials. */

type ListInput = { query?: string; limit?: number; cursor?: string };

const serviceColumns = {
  id: true,
  name: true,
  description: true,
  price: true,
  created_at: true,
} as const;

const serviceMaterialsWith = {
  materials: {
    where: isNull(serviceMaterial.deleted_at),
    orderBy: [asc(serviceMaterial.sort_order), asc(serviceMaterial.id)],
    columns: { material_id: true, quantity: true, price: true } as const,
    with: {
      material: {
        columns: {
          id: true,
          name: true,
          unit: true,
          price: true,
          company_id: true,
          deleted_at: true,
        } as const,
      },
    },
  },
};

type ServiceRow = {
  id: number;
  name: string;
  description: string;
  price: number;
  materials: Array<{
    material_id: number;
    quantity: number;
    price: number | null;
    material: {
      id: number;
      name: string;
      unit: string | null;
      price: number;
      company_id: number;
      deleted_at: Date | null;
    } | null;
  }>;
};

const mapAgentService = (row: ServiceRow, companyId: number) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  price: row.price,
  default_materials: row.materials
    // A removed material, or one of another company, is never offered.
    .filter(
      (link): link is typeof link & { material: NonNullable<typeof link.material> } =>
        link.material != null &&
        link.material.deleted_at == null &&
        link.material.company_id === companyId,
    )
    .map((link) => ({
      material_id: link.material_id,
      name: link.material.name,
      quantity: link.quantity,
      unit: link.material.unit,
      price: link.price ?? link.material.price,
    })),
});

/** One live service of the company with its default materials, or null (ZIG-I23-5 fetch). */
export const getAgentService = async (
  agent: Pick<AgentContext, 'companyId'>,
  serviceId: number,
) => {
  const row = await db.query.service.findFirst({
    where: and(
      eq(service.id, serviceId),
      eq(service.company_id, agent.companyId),
      isNull(service.deleted_at),
    ),
    columns: serviceColumns,
    with: serviceMaterialsWith,
  });
  return row ? mapAgentService(row, agent.companyId) : null;
};

/** Services with their default materials (ServiceMaterial, ZIG-I10). */
export const listAgentServices = async (agent: AgentContext, input: ListInput) => {
  const limit = clampListLimit(input.limit);
  const conditions = [eq(service.company_id, agent.companyId), isNull(service.deleted_at)];
  if (input.query) {
    const pattern = toLikePattern(input.query);
    conditions.push(or(ilike(service.name, pattern), ilike(service.description, pattern))!);
  }
  const keyset = afterCursor({ createdAt: service.created_at, id: service.id }, input.cursor);
  if (keyset) conditions.push(keyset);

  const rows = await db.query.service.findMany({
    where: and(...conditions),
    orderBy: [desc(service.created_at), desc(service.id)],
    limit: limit + 1,
    columns: serviceColumns,
    with: serviceMaterialsWith,
  });

  const { items, nextCursor } = toPage(rows, limit);
  return {
    services: items.map((row) => mapAgentService(row, agent.companyId)),
    next_cursor: nextCursor,
  };
};

export const listAgentMaterials = async (agent: AgentContext, input: ListInput) => {
  const limit = clampListLimit(input.limit);
  const conditions = [eq(material.company_id, agent.companyId), isNull(material.deleted_at)];
  if (input.query) conditions.push(ilike(material.name, toLikePattern(input.query)));
  const keyset = afterCursor({ createdAt: material.created_at, id: material.id }, input.cursor);
  if (keyset) conditions.push(keyset);

  const rows = await db
    .select({
      id: material.id,
      name: material.name,
      unit: material.unit,
      price: material.price,
      created_at: material.created_at,
    })
    .from(material)
    .where(and(...conditions))
    .orderBy(desc(material.created_at), desc(material.id))
    .limit(limit + 1);

  const { items, nextCursor } = toPage(rows, limit);
  return {
    materials: items.map(({ id, name, unit, price }) => ({ id, name, unit, price })),
    next_cursor: nextCursor,
  };
};
