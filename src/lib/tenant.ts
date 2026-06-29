/**
 * Tenant-scoping helpers. Multi-tenancy in ZigZag is enforced by explicitly
 * filtering every query by `company_id` (Drizzle does not do this
 * automatically). These helpers make that filter consistent and hard to forget,
 * and provide a runtime guard against cross-tenant row access.
 *
 * Usage:
 *   const rows = await db.select().from(ticket)
 *     .where(tenantScope(ticket, companyId));
 *
 *   // include soft-deleted rows:
 *   tenantScope(ticket, companyId, { includeDeleted: true })
 */
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { AuthorizationError } from '@/lib/errors';

/** Minimal shape: a table exposing tenant + soft-delete columns. */
export type TenantTable = {
  company_id: AnyPgColumn;
  deleted_at: AnyPgColumn;
};

export type TenantScopeOptions = {
  /** Include soft-deleted rows (default false). */
  includeDeleted?: boolean;
};

/**
 * Build the canonical tenant filter: `company_id = :id [AND deleted_at IS NULL]`.
 * Returns a Drizzle condition to drop into `.where()`.
 */
export const tenantScope = (
  table: TenantTable,
  companyId: number,
  options: TenantScopeOptions = {},
): SQL => {
  const companyCondition = eq(table.company_id, companyId);
  if (options.includeDeleted) {
    return companyCondition;
  }
  return and(companyCondition, isNull(table.deleted_at)) as SQL;
};

/**
 * Compose the tenant filter with additional conditions in one call, so callers
 * cannot accidentally omit the company filter when adding more predicates.
 */
export const withTenant = (
  table: TenantTable,
  companyId: number,
  ...conditions: Array<SQL | undefined>
): SQL =>
  and(tenantScope(table, companyId), ...conditions) as SQL;

/**
 * Runtime guard: assert a loaded row belongs to the expected company before
 * returning or mutating it. Defends against logic that fetches by primary key
 * and forgets the tenant check.
 */
export const assertTenantOwnership = (
  row: { company_id: number | null } | null | undefined,
  companyId: number,
): void => {
  if (!row || row.company_id !== companyId) {
    throw new AuthorizationError('Cross-tenant access denied');
  }
};
