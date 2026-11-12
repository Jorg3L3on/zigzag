'use server';

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { auditEvent, user } from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  buildLifecycleHistory,
  type LifecycleHistoryRow,
} from '@/lib/operator-lifecycle-history';
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';

export type OperatorLifecycleData = {
  history: LifecycleHistoryRow[];
  lastExportAt: string | null;
  /** Archived only: who archived it and why (frame 6B). */
  archived: { at: string; who: string; reason: string | null } | null;
};

/**
 * Ciclo de vida (ZIG-I38-7): status history read from the company's audit
 * events (only the status fields and the reason are read from the payload),
 * and the date of the last export.
 */
export async function getOperatorCompanyLifecycle(companyId: number): Promise<{
  success: boolean;
  data?: OperatorLifecycleData;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    if (!Number.isInteger(companyId) || companyId < 1) return buildActionError('CO006');
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);
    await requireActionPermission('companies.read', companyId);

    const [events, lastExport] = await Promise.all([
      db
        .select({
          id: auditEvent.id,
          at: auditEvent.occurred_at,
          action: auditEvent.action,
          before_status: sql<string | null>`${auditEvent.payload} -> 'before' ->> 'status'`,
          after_status: sql<string | null>`${auditEvent.payload} -> 'after' ->> 'status'`,
          reason: sql<string | null>`${auditEvent.payload} ->> 'reason'`,
          actor_name: user.name,
          actor_company_id: auditEvent.actor_company_id,
          target_company_id: auditEvent.target_company_id,
        })
        .from(auditEvent)
        .leftJoin(user, eq(user.id, auditEvent.actor_user_id))
        .where(
          and(
            eq(auditEvent.target_company_id, companyId),
            eq(auditEvent.resource_type, 'company'),
            inArray(auditEvent.action, ['created', 'updated', 'offboarded']),
          ),
        )
        .orderBy(desc(auditEvent.occurred_at))
        .limit(200),
      db
        .select({ at: auditEvent.occurred_at })
        .from(auditEvent)
        .where(
          and(
            eq(auditEvent.target_company_id, companyId),
            eq(auditEvent.resource_type, 'company'),
            eq(auditEvent.action, 'export_generated'),
          ),
        )
        .orderBy(desc(auditEvent.occurred_at))
        .limit(1),
    ]);

    const history = buildLifecycleHistory(events);
    const archivedRow = history.find((row) => row.title === 'Archivada');

    return {
      success: true,
      data: {
        history,
        lastExportAt: lastExport[0]?.at?.toISOString() ?? null,
        archived: archivedRow
          ? { at: archivedRow.at, who: archivedRow.who, reason: archivedRow.reason }
          : null,
      },
    };
  } catch (error) {
    return handleCodedServerActionError('operator.lifecycle', 'CO002', error);
  }
}
