import { asc, eq } from 'drizzle-orm';

import { plan, type Plan } from '@/db/schema';
import { db } from '@/lib/db';

export const listPlans = async (): Promise<Plan[]> =>
  db.select().from(plan).orderBy(asc(plan.id));

export const getPlanById = async (id: number): Promise<Plan | null> => {
  const rows = await db.select().from(plan).where(eq(plan.id, id)).limit(1);
  return rows[0] ?? null;
};

export const getPlanBySlug = async (slug: string): Promise<Plan | null> => {
  const rows = await db.select().from(plan).where(eq(plan.slug, slug)).limit(1);
  return rows[0] ?? null;
};
