import {
  and,
  desc,
  eq,
  gte,
  ilike,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { auditEvent } from '@/db/schema';
import { db } from '@/lib/db';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_RESULTS,
} from '@/lib/audit-catalog';

export type AuditEventFilters = {
  targetCompanyId?: number;
  actorUserId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  result?: string;
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
  actor_company_id: number | null;
  target_company_id: number | null;
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

  if (filters.action && !isKnownValue(AUDIT_ACTIONS, filters.action)) {
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
  if (normalized.resourceId) {
    conditions.push(eq(auditEvent.resource_id, normalized.resourceId));
  }
  if (normalized.action) {
    conditions.push(eq(auditEvent.action, normalized.action));
  }
  if (normalized.result) {
    conditions.push(eq(auditEvent.result, normalized.result));
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

const buildAuditSearchCondition = (search: string): SQL | null => {
  const trimmed = search.trim();
  if (!trimmed) {
    return null;
  }

  const term = `%${trimmed}%`;

  return or(
    ilike(auditEvent.resource_type, term),
    ilike(auditEvent.resource_id, term),
    ilike(auditEvent.action, term),
    ilike(auditEvent.result, term),
    ilike(auditEvent.source, term),
    sql`${auditEvent.payload}::text ILIKE ${term}`,
    sql`${auditEvent.request_meta}::text ILIKE ${term}`,
  ) as SQL;
};

const mapAuditRows = (
  rows: (typeof auditEvent.$inferSelect)[],
): AuditEventListItem[] =>
  rows.map((row) => ({
    id: row.id,
    occurred_at: row.occurred_at.toISOString(),
    actor_user_id: row.actor_user_id?.toString() ?? null,
    actor_company_id: row.actor_company_id,
    target_company_id: row.target_company_id,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    action: row.action,
    result: row.result,
    source: row.source,
    payload: row.payload,
    request_meta: row.request_meta,
  }));

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

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: mapAuditRows(pageRows),
    nextCursor: hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null,
  };
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

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: mapAuditRows(pageRows),
    nextCursor: hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null,
  };
};
