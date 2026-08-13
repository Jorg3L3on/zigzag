import { and, desc, eq, inArray, isNull, max } from 'drizzle-orm';
import { auditEvent, company, type Company } from '@/db/schema';
import {
  buildFleetIncidentSnapshot,
  buildOperatorFleetRow,
  type OperatorFleetRow,
} from '@/lib/company-operator-fleet';
import { db } from '@/lib/db';
import { buildOperatorIncidentSqlCondition } from '@/lib/operator-audit-incidents-sql';

const loadFleetActivityByCompany = async (
  companyIds: number[],
): Promise<Map<number, Date>> => {
  const map = new Map<number, Date>();
  if (companyIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({
      companyId: auditEvent.target_company_id,
      lastActivityAt: max(auditEvent.occurred_at),
    })
    .from(auditEvent)
    .where(inArray(auditEvent.target_company_id, companyIds))
    .groupBy(auditEvent.target_company_id);

  for (const row of rows) {
    if (row.companyId != null && row.lastActivityAt) {
      map.set(row.companyId, row.lastActivityAt);
    }
  }
  return map;
};

/**
 * Latest operator incident per company. Fetches incident-matching rows newest-first
 * and keeps the first hit per `target_company_id` (fleet size is small).
 */
const loadFleetIncidentsByCompany = async (
  companyIds: number[],
): Promise<
  Map<
    number,
    {
      occurred_at: Date;
      action: string;
      result: string;
      resource_type: string;
      payload: Record<string, unknown> | null;
    }
  >
> => {
  const map = new Map<
    number,
    {
      occurred_at: Date;
      action: string;
      result: string;
      resource_type: string;
      payload: Record<string, unknown> | null;
    }
  >();
  if (companyIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({
      targetCompanyId: auditEvent.target_company_id,
      occurredAt: auditEvent.occurred_at,
      action: auditEvent.action,
      result: auditEvent.result,
      resourceType: auditEvent.resource_type,
      payload: auditEvent.payload,
    })
    .from(auditEvent)
    .where(
      and(
        inArray(auditEvent.target_company_id, companyIds),
        buildOperatorIncidentSqlCondition(),
      ),
    )
    .orderBy(desc(auditEvent.occurred_at));

  for (const row of rows) {
    if (row.targetCompanyId == null || map.has(row.targetCompanyId)) {
      continue;
    }
    map.set(row.targetCompanyId, {
      occurred_at: row.occurredAt,
      action: row.action,
      result: row.result,
      resource_type: row.resourceType,
      payload: row.payload ?? null,
    });
  }
  return map;
};

export const loadCompanyOperatorFleet = async (): Promise<
  OperatorFleetRow[]
> => {
  const companies = (await db.query.company.findMany({
    where: and(isNull(company.deleted_at), eq(company.is_system, false)),
    orderBy: (fields, { desc: descFn }) => [descFn(fields.created_at)],
  })) as Company[];

  const ids = companies.map((row) => row.id);

  const [activityByCompany, incidentByCompany] = await Promise.all([
    loadFleetActivityByCompany(ids),
    loadFleetIncidentsByCompany(ids),
  ]);

  return companies.map((row) => {
    const incident = incidentByCompany.get(row.id);
    const incidentSnapshot = buildFleetIncidentSnapshot(
      incident ?? null,
    );

    return buildOperatorFleetRow(row, {
      lastActivityAt: activityByCompany.get(row.id) ?? null,
      lastIncidentAt: incidentSnapshot.lastIncidentAt,
      lastIncidentLabel: incidentSnapshot.lastIncidentLabel,
    });
  });
};
