import { and, eq, isNull } from 'drizzle-orm';
import { company, type Company } from '@/db/schema';
import {
  buildOperatorFleetRow,
  type OperatorFleetRow,
} from '@/lib/company-operator-fleet';
import {
  loadLastSignInByCompany,
  loadPeopleCountByCompany,
  loadSecurityAlertsByCompany,
  loadStatusSinceByCompany,
} from '@/lib/company-operator-facts-loader';
import { normalizeCompanyLifecycleStatus } from '@/lib/company-lifecycle';
import { db } from '@/lib/db';

/**
 * The fleet (ZIG-I38-1): one row per tenant with people, last sign-in by a
 * user of the company, the live security alert, status-since and retention.
 * Each fact is one grouped query keyed by the company ids.
 */
export const loadCompanyOperatorFleet = async (
  now: Date = new Date(),
): Promise<OperatorFleetRow[]> => {
  const companies = (await db.query.company.findMany({
    where: and(isNull(company.deleted_at), eq(company.is_system, false)),
    orderBy: (fields, { desc: descFn }) => [descFn(fields.created_at)],
  })) as Company[];

  const ids = companies.map((row) => row.id);

  const [people, lastSignIn, alerts, statusSince] = await Promise.all([
    loadPeopleCountByCompany(ids),
    loadLastSignInByCompany(ids),
    loadSecurityAlertsByCompany(ids, now),
    loadStatusSinceByCompany(
      companies.map((row) => ({
        id: row.id,
        status: normalizeCompanyLifecycleStatus(row.status),
      })),
    ),
  ]);

  return companies.map((row) =>
    buildOperatorFleetRow(
      row,
      {
        peopleCount: people.get(row.id) ?? 0,
        lastSignInAt: lastSignIn.get(row.id) ?? null,
        alert: alerts.get(row.id) ?? null,
        statusSince: statusSince.get(row.id) ?? null,
      },
      now,
    ),
  );
};
