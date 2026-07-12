import { recordAuditEvent } from '@/lib/audit';
import type { AuditAction, AuditSource } from '@/lib/audit-catalog';
import { db } from '@/lib/db';

export type AuthAuditFailureReason =
  | 'missing_credentials'
  | 'invalid_credentials'
  | 'throttled'
  | 'inactive_company';

export type PermissionDeniedAuditReason =
  | 'missing_permission'
  | 'invalid_company_context';

export const recordAuthAuditEvent = async (input: {
  action: Extract<AuditAction, 'signed_in' | 'signed_out' | 'sign_in_failed'>;
  result: 'success' | 'failed';
  actor?: {
    userId: string;
    companyId: number | null;
    companyIsSystem: boolean;
  } | null;
  targetCompanyId?: number | null;
  resourceId?: string | null;
  email?: string | null;
  reason?: AuthAuditFailureReason;
}): Promise<void> => {
  await recordAuditEvent(db, {
    actor: input.actor ?? null,
    targetCompanyId: input.targetCompanyId ?? input.actor?.companyId ?? null,
    resourceType: 'auth',
    resourceId: input.resourceId ?? input.actor?.userId ?? input.email ?? null,
    action: input.action,
    result: input.result,
    source: 'auth',
    payload: {
      ...(input.email ? { email: input.email } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    },
  });
};

export const recordPermissionDeniedAudit = async (input: {
  actor: {
    userId: string;
    companyId: number | null;
    companyIsSystem: boolean;
  };
  targetCompanyId: number | null;
  permission: string;
  source: Extract<AuditSource, 'action' | 'api'>;
  reason?: PermissionDeniedAuditReason;
  actorCompanyId?: number | null;
  requestedCompanyId?: number | null;
  requestMeta?: Record<string, unknown>;
}): Promise<void> => {
  await recordAuditEvent(db, {
    actor: input.actor,
    targetCompanyId: input.targetCompanyId,
    resourceType: 'security',
    resourceId: input.permission,
    action: 'permission_denied',
    result: 'denied',
    source: input.source,
    payload: {
      permission: input.permission,
      error_code: 'AU002',
      denial_reason: input.reason ?? 'missing_permission',
      actor_company_id: input.actorCompanyId ?? input.actor.companyId,
      requested_company_id: input.requestedCompanyId ?? input.targetCompanyId,
    },
    requestMeta: input.requestMeta,
  });
};
