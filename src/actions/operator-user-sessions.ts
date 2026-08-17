'use server';

import { and, eq, inArray, isNull, max } from 'drizzle-orm';
import { auditEvent, user } from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  buildOperatorUserSessionRows,
  type OperatorUserSessionRow,
} from '@/lib/operator-user-sessions';
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';

export type OperatorUserSessionsResponse = {
  success: boolean;
  data?: OperatorUserSessionRow[];
  error?: string;
  errorType?: ActionErrorType;
};

export async function fetchOperatorUserSessions(
  companyId: number,
): Promise<OperatorUserSessionsResponse> {
  try {
    if (!Number.isFinite(companyId) || companyId < 1) {
      return buildActionError('CO006');
    }

    const authContext = await requireActionAuth();
    requireSystemUser(authContext);
    await requireActionPermission('users.read', companyId);

    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
      })
      .from(user)
      .where(and(eq(user.company_id, companyId), isNull(user.deleted_at)));

    if (users.length === 0) {
      return { success: true, data: [] };
    }

    const userIds = users.map((row) => row.id);
    const loginRows = await db
      .select({
        actorUserId: auditEvent.actor_user_id,
        lastSignedInAt: max(auditEvent.occurred_at),
      })
      .from(auditEvent)
      .where(
        and(
          eq(auditEvent.action, 'signed_in'),
          inArray(auditEvent.actor_user_id, userIds),
        ),
      )
      .groupBy(auditEvent.actor_user_id);

    const lastByUser = new Map<string, Date>();
    for (const row of loginRows) {
      if (row.actorUserId != null && row.lastSignedInAt) {
        lastByUser.set(String(row.actorUserId), row.lastSignedInAt);
      }
    }

    const data = buildOperatorUserSessionRows(
      users.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        lastSignedInAt: lastByUser.get(String(row.id)) ?? null,
      })),
    );

    return { success: true, data };
  } catch (error) {
    return handleCodedServerActionError(
      'operator.user-sessions',
      'CO002',
      error,
    );
  }
}
