import {
  governanceAuditEvent,
  rolePermission,
  type Company,
  type Permission,
  type Role,
  type User,
} from '@/db/schema';
import type { ActionAuthContext } from '@/lib/authz-context';
import { toAuditJson } from '@/lib/audit';
import type { db } from '@/lib/db';

export { toAuditJson, sanitizeUserForAudit } from '@/lib/audit';

export const GOVERNANCE_RESOURCE_TYPES = [
  'company',
  'user',
  'role',
  'permission',
] as const;

export type GovernanceResourceType =
  (typeof GOVERNANCE_RESOURCE_TYPES)[number];

export const GOVERNANCE_EVENT_TYPES = [
  'created',
  'updated',
  'deleted',
  'logo_uploaded',
  'logo_removed',
  'permissions_changed',
  'permission_assigned',
  'permission_removed',
  'export_generated',
  'offboarded',
] as const;

export type GovernanceEventType = (typeof GOVERNANCE_EVENT_TYPES)[number];

export type GovernanceAuditActor = {
  userId: string;
  companyId: number | null;
  companyIsSystem: boolean;
};

export type GovernanceAuditWriter = Pick<typeof db, 'insert'>;

export type GovernanceAuditDb = Pick<typeof db, 'insert' | 'select'>;

export const sanitizeCompanyForAudit = (
  row: Company | null | undefined,
): Record<string, unknown> | null => {
  if (!row) {
    return null;
  }
  return { ...row };
};

export const sanitizeRoleForAudit = (
  row: Role | null | undefined,
  permissionIds?: number[],
): Record<string, unknown> | null => {
  if (!row) {
    return null;
  }
  const base = { ...row } as Record<string, unknown>;
  if (permissionIds !== undefined) {
    base.permission_ids = permissionIds;
  }
  return base;
};

export const sanitizePermissionForAudit = (
  row: Permission | null | undefined,
): Record<string, unknown> | null => {
  if (!row) {
    return null;
  }
  return { ...row };
};

export const actionAuthToGovernanceActor = (
  context: ActionAuthContext,
): GovernanceAuditActor => ({
  userId: context.userId,
  companyId: context.companyId,
  companyIsSystem: context.companyIsSystem,
});

export const sessionUserToGovernanceActor = (sessionUser: {
  id: string;
  company_id: number | null;
  company_is_system?: boolean;
}): GovernanceAuditActor => ({
  userId: sessionUser.id,
  companyId: sessionUser.company_id,
  companyIsSystem: Boolean(sessionUser.company_is_system),
});

export const resolveGovernanceTargetCompanyId = (
  actor: GovernanceAuditActor,
  resourceCompanyId: number | null | undefined,
): number | null => resourceCompanyId ?? actor.companyId;

export const buildGovernanceAuditPayload = (input: {
  actor: GovernanceAuditActor;
  mutation: GovernanceEventType;
  before?: unknown;
  after?: unknown;
  targetCompanyId: number | null;
  extra?: Record<string, unknown>;
}): Record<string, unknown> => {
  const crossCompany =
    input.actor.companyIsSystem &&
    input.targetCompanyId !== null &&
    input.actor.companyId !== null &&
    input.targetCompanyId !== input.actor.companyId;

  return {
    mutation: input.mutation,
    before: input.before === undefined ? null : toAuditJson(input.before),
    after: input.after === undefined ? null : toAuditJson(input.after),
    cross_company: crossCompany,
    actor: {
      user_id: input.actor.userId,
      company_id: input.actor.companyId,
      company_is_system: input.actor.companyIsSystem,
    },
    target_company_id: input.targetCompanyId,
    ...input.extra,
  };
};

export const normalizeGovernanceResourceId = (
  resourceId: string | number | bigint,
): string => resourceId.toString();

export const fetchRolePermissionIds = async (
  roleId: number,
  tx?: GovernanceAuditDb,
): Promise<number[]> => {
  const { eq } = await import('drizzle-orm');
  const dbClient = tx ?? (await import('@/lib/db')).db;
  const rows = await dbClient
    .select({ permission_id: rolePermission.permission_id })
    .from(rolePermission)
    .where(eq(rolePermission.role_id, roleId));

  return rows.map((row) => row.permission_id);
};

export const recordGovernanceAudit = async (
  tx: GovernanceAuditWriter,
  input: {
    actor: GovernanceAuditActor;
    resourceType: GovernanceResourceType;
    resourceId: string | number | bigint;
    targetCompanyId: number | null;
    eventType: GovernanceEventType;
    before?: unknown;
    after?: unknown;
    extra?: Record<string, unknown>;
  },
): Promise<void> => {
  await tx.insert(governanceAuditEvent).values({
    resource_type: input.resourceType,
    resource_id: normalizeGovernanceResourceId(input.resourceId),
    company_id: input.targetCompanyId,
    actor_user_id: BigInt(input.actor.userId),
    actor_company_id: input.actor.companyId,
    event_type: input.eventType,
    payload: buildGovernanceAuditPayload({
      actor: input.actor,
      mutation: input.eventType,
      before: input.before,
      after: input.after,
      targetCompanyId: input.targetCompanyId,
      extra: input.extra,
    }) as Record<string, unknown>,
  });
};
