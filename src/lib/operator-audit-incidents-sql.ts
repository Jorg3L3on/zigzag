import { and, eq, or, type SQL } from 'drizzle-orm';
import { auditEvent } from '@/db/schema';

/**
 * SQL predicate matching {@link isOperatorIncidentEvent} for server-side filters.
 * Server-only — do not import from Client Components. No payload text search.
 */
export const buildOperatorIncidentSqlCondition = (): SQL =>
  or(
    eq(auditEvent.action, 'sign_in_failed'),
    eq(auditEvent.action, 'permission_denied'),
    and(eq(auditEvent.resource_type, 'auth'), eq(auditEvent.result, 'failed')),
    and(
      eq(auditEvent.resource_type, 'security'),
      eq(auditEvent.result, 'denied'),
    ),
  ) as SQL;
