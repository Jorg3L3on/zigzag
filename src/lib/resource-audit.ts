import { recordAuditEvent, buildAuditPayload, type AuditWriter } from '@/lib/audit';
import type { AuditAction, AuditSource } from '@/lib/audit-catalog';
import type { ActionAuthContext } from '@/lib/authz-context';
import { db } from '@/lib/db';

export type ResourceAuditType = 'client' | 'service';

export type ResourceAuditAction = Extract<AuditAction, 'created' | 'updated' | 'deleted'>;

export const recordResourceAudit = async (
  tx: AuditWriter,
  input: {
    actor: ActionAuthContext;
    resourceType: ResourceAuditType;
    resourceId: number;
    targetCompanyId: number;
    action: ResourceAuditAction;
    before?: unknown;
    after?: unknown;
    source: Extract<AuditSource, 'action' | 'api'>;
  },
): Promise<void> => {
  await recordAuditEvent(tx, {
    actor: {
      userId: input.actor.userId,
      companyId: input.actor.companyId,
      companyIsSystem: input.actor.companyIsSystem,
    },
    targetCompanyId: input.targetCompanyId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    action: input.action,
    result: 'success',
    source: input.source,
    payload: buildAuditPayload({
      actor: {
        userId: input.actor.userId,
        companyId: input.actor.companyId,
        companyIsSystem: input.actor.companyIsSystem,
      },
      targetCompanyId: input.targetCompanyId,
      before: input.before,
      after: input.after,
    }),
  });
};

export const recordDocumentGeneratedAudit = async (input: {
  actor: ActionAuthContext;
  resourceType: 'ticket' | 'report';
  resourceId: string | number;
  targetCompanyId: number;
  requestMeta?: Record<string, unknown>;
}): Promise<void> => {
  const auditResourceType = input.resourceType === 'ticket' ? 'invoice' : 'report';

  await recordAuditEvent(db, {
    actor: {
      userId: input.actor.userId,
      companyId: input.actor.companyId,
      companyIsSystem: input.actor.companyIsSystem,
    },
    targetCompanyId: input.targetCompanyId,
    resourceType: auditResourceType,
    resourceId: input.resourceId,
    action: 'generated',
    result: 'success',
    source: 'api',
    requestMeta: input.requestMeta,
  });
};
