import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { auditEvent, company } from '@/db/schema';
import { db } from '@/lib/db';
import { resolveActorNames } from '@/lib/audit-actor-names';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_RESULTS,
} from '@/lib/audit-catalog';
import { resolveAuditSearchCatalogMatches } from '@/lib/audit-labels';
import { buildOperatorIncidentSqlCondition } from '@/lib/operator-audit-incidents-sql';

export type AuditEventFilters = {
  targetCompanyId?: number;
  actorUserId?: string;
  resourceType?: string;
  /** Optional multi-type filter (AND with single resourceType if both set). */
  resourceTypes?: string[];
  resourceId?: string;
  action?: string;
  /** Optional multi-action filter. */
  actions?: string[];
  result?: string;
  /** When true, only return operator-incident audit rows. */
  incidentsOnly?: boolean;
  from?: Date;
  to?: Date;
  cursor?: number;
  limit?: number;
};

export type NormalizedAuditEventFilters = AuditEventFilters & {
  invalid: boolean;
};

export type AuditEventListItem = {
  id: number;
  occurred_at: string;
  actor_user_id: string | null;
  /** Resolved from User.name when the actor still exists. */
  actor_name: string | null;
  actor_company_id: number | null;
  actor_company_name: string | null;
  target_company_id: number | null;
  target_company_name: string | null;
  resource_type: string;
  resource_id: string | null;
  action: string;
  result: string;
  source: string;
  payload: Record<string, unknown> | null;
  request_meta: Record<string, unknown> | null;
};

const isKnownValue = <T extends string>(
  values: readonly T[],
  value: string,
): value is T => (values as readonly string[]).includes(value);

export const normalizeAuditLimit = (limit?: number): number =>
  Math.min(Math.max(limit ?? 50, 1), 100);

export const normalizeAuditExportLimit = (limit?: number): number =>
  Math.min(Math.max(limit ?? 1000, 1), 5000);

export const normalizeAuditEventFilters = (
  filters: AuditEventFilters,
): NormalizedAuditEventFilters => {
  const actorUserId = filters.actorUserId?.trim();
  let invalid = false;

  if (actorUserId) {
    try {
      BigInt(actorUserId);
    } catch {
      invalid = true;
    }
  }

  if (
    filters.resourceType &&
    !isKnownValue(AUDIT_RESOURCE_TYPES, filters.resourceType)
  ) {
    invalid = true;
  }

  if (
    filters.resourceTypes?.some(
      (value) => !isKnownValue(AUDIT_RESOURCE_TYPES, value),
    )
  ) {
    invalid = true;
  }

  if (filters.action && !isKnownValue(AUDIT_ACTIONS, filters.action)) {
    invalid = true;
  }

  if (filters.actions?.some((value) => !isKnownValue(AUDIT_ACTIONS, value))) {
    invalid = true;
  }

  if (filters.result && !isKnownValue(AUDIT_RESULTS, filters.result)) {
    invalid = true;
  }

  return {
    ...filters,
    actorUserId,
    invalid,
  };
};

const buildAuditFilterConditions = (filters: AuditEventFilters): SQL[] => {
  const normalized = normalizeAuditEventFilters(filters);
  const conditions: SQL[] = [];

  if (normalized.invalid) {
    conditions.push(sql`false`);
    return conditions;
  }

  if (normalized.targetCompanyId != null) {
    conditions.push(eq(auditEvent.target_company_id, normalized.targetCompanyId));
  }
  if (normalized.actorUserId) {
    conditions.push(eq(auditEvent.actor_user_id, BigInt(normalized.actorUserId)));
  }
  if (normalized.resourceType) {
    conditions.push(eq(auditEvent.resource_type, normalized.resourceType));
  }
  if (normalized.resourceTypes && normalized.resourceTypes.length > 0) {
    conditions.push(inArray(auditEvent.resource_type, normalized.resourceTypes));
  }
  if (normalized.resourceId) {
    conditions.push(eq(auditEvent.resource_id, normalized.resourceId));
  }
  if (normalized.action) {
    conditions.push(eq(auditEvent.action, normalized.action));
  }
  if (normalized.actions && normalized.actions.length > 0) {
    conditions.push(inArray(auditEvent.action, normalized.actions));
  }
  if (normalized.result) {
    conditions.push(eq(auditEvent.result, normalized.result));
  }
  if (normalized.incidentsOnly) {
    conditions.push(buildOperatorIncidentSqlCondition());
  }
  if (normalized.from) {
    conditions.push(gte(auditEvent.occurred_at, normalized.from));
  }
  if (normalized.to) {
    conditions.push(lte(auditEvent.occurred_at, normalized.to));
  }
  if (normalized.cursor != null) {
    conditions.push(lt(auditEvent.id, normalized.cursor));
  }

  return conditions;
};

/** Exported for unit tests covering Spanish label → enum search. */
export const buildAuditSearchCondition = (search: string): SQL | null => {
  const trimmed = search.trim();
  if (!trimmed) {
    return null;
  }

  const term = `%${trimmed}%`;
  const matches = resolveAuditSearchCatalogMatches(trimmed);
  const catalogClauses: SQL[] = [];

  if (matches.actions.length > 0) {
    catalogClauses.push(inArray(auditEvent.action, matches.actions));
  }
  if (matches.results.length > 0) {
    catalogClauses.push(inArray(auditEvent.result, matches.results));
  }
  if (matches.resourceTypes.length > 0) {
    catalogClauses.push(
      inArray(auditEvent.resource_type, matches.resourceTypes),
    );
  }
  if (matches.sources.length > 0) {
    catalogClauses.push(inArray(auditEvent.source, matches.sources));
  }

  return or(
    ilike(auditEvent.resource_type, term),
    ilike(auditEvent.resource_id, term),
    ilike(auditEvent.action, term),
    ilike(auditEvent.result, term),
    ilike(auditEvent.source, term),
    sql`${auditEvent.payload}::text ILIKE ${term}`,
    sql`${auditEvent.request_meta}::text ILIKE ${term}`,
    ...catalogClauses,
  ) as SQL;
};

const resolveCompanyNames = async (
  companyIds: number[],
): Promise<Map<number, string>> => {
  const unique = [...new Set(companyIds)];
  const map = new Map<number, string>();
  if (unique.length === 0) {
    return map;
  }

  const rows = await db
    .select({ id: company.id, name: company.name })
    .from(company)
    .where(inArray(company.id, unique));

  for (const row of rows) {
    map.set(row.id, row.name);
  }
  return map;
};

const mapAuditRows = (
  rows: (typeof auditEvent.$inferSelect)[],
  actorNames: Map<string, string>,
  companyNames: Map<number, string>,
): AuditEventListItem[] =>
  rows.map((row) => {
    const actorUserId = row.actor_user_id?.toString() ?? null;
    return {
      id: row.id,
      occurred_at: row.occurred_at.toISOString(),
      actor_user_id: actorUserId,
      actor_name: actorUserId ? (actorNames.get(actorUserId) ?? null) : null,
      actor_company_id: row.actor_company_id,
      actor_company_name:
        row.actor_company_id != null
          ? (companyNames.get(row.actor_company_id) ?? null)
          : null,
      target_company_id: row.target_company_id,
      target_company_name:
        row.target_company_id != null
          ? (companyNames.get(row.target_company_id) ?? null)
          : null,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      action: row.action,
      result: row.result,
      source: row.source,
      payload: row.payload,
      request_meta: row.request_meta,
    };
  });

const toAuditPage = async (
  rows: (typeof auditEvent.$inferSelect)[],
  limit: number,
): Promise<{ items: AuditEventListItem[]; nextCursor: number | null }> => {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const actorNames = await resolveActorNames(
    pageRows.map((row) => row.actor_user_id?.toString() ?? null),
  );
  const companyNames = await resolveCompanyNames(
    pageRows.flatMap((row) =>
      [row.actor_company_id, row.target_company_id].filter(
        (id): id is number => id != null,
      ),
    ),
  );

  return {
    items: mapAuditRows(pageRows, actorNames, companyNames),
    nextCursor: hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null,
  };
};

export const queryAuditEvents = async (
  filters: AuditEventFilters,
): Promise<{ items: AuditEventListItem[]; nextCursor: number | null }> => {
  const conditions = buildAuditFilterConditions(filters);
  const limit = normalizeAuditLimit(filters.limit);

  const rows = await db
    .select()
    .from(auditEvent)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditEvent.occurred_at), desc(auditEvent.id))
    .limit(limit + 1);

  return toAuditPage(rows, limit);
};

export const searchAuditEvents = async (
  search: string,
  filters: AuditEventFilters,
): Promise<{ items: AuditEventListItem[]; nextCursor: number | null }> => {
  const searchCondition = buildAuditSearchCondition(search);
  if (!searchCondition) {
    return queryAuditEvents(filters);
  }

  const conditions = [...buildAuditFilterConditions(filters), searchCondition];
  const limit = normalizeAuditLimit(filters.limit);

  const rows = await db
    .select()
    .from(auditEvent)
    .where(and(...conditions))
    .orderBy(desc(auditEvent.occurred_at), desc(auditEvent.id))
    .limit(limit + 1);

  return toAuditPage(rows, limit);
};

/** Page through filtered audit events up to an export cap (System console CSV). */
export const exportAuditEvents = async (
  search: string,
  filters: Omit<AuditEventFilters, 'cursor' | 'limit'>,
  maxRows = 5000,
): Promise<AuditEventListItem[]> => {
  const cap = normalizeAuditExportLimit(maxRows);
  const collected: AuditEventListItem[] = [];
  let cursor: number | undefined;

  while (collected.length < cap) {
    const pageLimit = Math.min(100, cap - collected.length);
    const page = search.trim()
      ? await searchAuditEvents(search, {
          ...filters,
          cursor,
          limit: pageLimit,
        })
      : await queryAuditEvents({ ...filters, cursor, limit: pageLimit });

    collected.push(...page.items);
    if (!page.nextCursor || page.items.length === 0) {
      break;
    }
    cursor = page.nextCursor;
  }

  return collected.slice(0, cap);
};
