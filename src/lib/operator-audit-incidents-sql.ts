import { and, eq, ne, or, sql, type SQL } from 'drizzle-orm';
import { auditEvent } from '@/db/schema';

/**
 * SQL predicate matching {@link isOperatorIncidentEvent} for server-side filters.
 * Server-only — do not import from Client Components.
 */
export const buildOperatorIncidentSqlCondition = (): SQL =>
  or(
    eq(auditEvent.action, 'sign_in_failed'),
    eq(auditEvent.action, 'permission_denied'),
    and(eq(auditEvent.resource_type, 'auth'), ne(auditEvent.result, 'success')),
    and(
      eq(auditEvent.resource_type, 'security'),
      eq(auditEvent.result, 'denied'),
    ),
    sql`${auditEvent.payload}::text ILIKE ${'%co011%'}`,
    sql`${auditEvent.payload}::text ILIKE ${'%límite del plan%'}`,
    sql`${auditEvent.payload}::text ILIKE ${'%limite del plan%'}`,
    sql`${auditEvent.payload}::text ILIKE ${'%plan limit%'}`,
  ) as SQL;
