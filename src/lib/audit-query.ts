import {
  and,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  lt,
  lte,
  or,
  type SQL,
} from 'drizzle-orm';
import { auditEvent } from '@/db/schema';
import { db } from '@/lib/db';

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

export const queryAuditEvents = async (
  filters: AuditEventFilters,
): Promise<{ items: AuditEventListItem[]; nextCursor: number | null }> => {
  const conditions: SQL[] = [];

  if (filters.targetCompanyId != null) {
    conditions.push(eq(auditEvent.target_company_id, filters.targetCompanyId));
  }
  if (filters.actorUserId) {
    conditions.push(eq(auditEvent.actor_user_id, BigInt(filters.actorUserId)));
  }
  if (filters.resourceType) {
    conditions.push(eq(auditEvent.resource_type, filters.resourceType));
  }
  if (filters.resourceId) {
    conditions.push(eq(auditEvent.resource_id, filters.resourceId));
  }
  if (filters.action) {
    conditions.push(eq(auditEvent.action, filters.action));
  }
  if (filters.result) {
    conditions.push(eq(auditEvent.result, filters.result));
  }
  if (filters.from) {
    conditions.push(gte(auditEvent.occurred_at, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(auditEvent.occurred_at, filters.to));
  }
  if (filters.cursor != null) {
    conditions.push(lt(auditEvent.id, filters.cursor));
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);

  const rows = await db
    .select()
    .from(auditEvent)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditEvent.occurred_at), desc(auditEvent.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const items: AuditEventListItem[] = pageRows.map((row) => ({
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

  return {
    items,
    nextCursor: hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null,
  };
};

export const searchAuditEvents = async (
  search: string,
  filters: AuditEventFilters,
): Promise<{ items: AuditEventListItem[]; nextCursor: number | null }> => {
  if (!search.trim()) {
    return queryAuditEvents(filters);
  }

  const term = `%${search.trim()}%`;
  const conditions: SQL[] = [
    or(
      ilike(auditEvent.resource_type, term),
      ilike(auditEvent.resource_id, term),
      ilike(auditEvent.action, term),
      ilike(auditEvent.result, term),
      isNotNull(auditEvent.payload),
    ) as SQL,
  ];

  if (filters.targetCompanyId != null) {
    conditions.push(eq(auditEvent.target_company_id, filters.targetCompanyId));
  }
  if (filters.cursor != null) {
    conditions.push(lt(auditEvent.id, filters.cursor));
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const rows = await db
    .select()
    .from(auditEvent)
    .where(and(...conditions))
    .orderBy(desc(auditEvent.occurred_at), desc(auditEvent.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: pageRows.map((row) => ({
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
    })),
    nextCursor: hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null,
  };
};
