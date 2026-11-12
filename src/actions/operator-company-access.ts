'use server';

import { and, asc, eq, gte, inArray, isNull, max, or, sql } from 'drizzle-orm';
import { auditEvent, role, user } from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { describeRoleAreas } from '@/lib/operator-role-areas';
import { hideShadowedSharedRoles } from '@/lib/role-visibility';
import {
  checkPermission,
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';
import { generateTemporaryPassword } from '@/lib/temporary-password';
import { createUser, deleteUser, updateUser } from '@/actions/users';

type Result<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
  errorType?: ActionErrorType;
  errorCode?: string;
};

export type OperatorAccessMember = {
  id: string;
  name: string;
  email: string;
  roleId: number | null;
  roleName: string | null;
  createdAt: string;
  lastSignedInAt: string | null;
  mustChangePassword: boolean;
  deactivated: boolean;
  /** Failed sign-ins of the account today (red line under Acceso). */
  failedToday: number;
};

export type OperatorAccessRole = {
  id: number;
  name: string;
  description: string | null;
  shared: boolean;
  areas: string;
  permissionCount: number;
  peopleCount: number;
};

export type OperatorAccessData = {
  members: OperatorAccessMember[];
  roles: OperatorAccessRole[];
  canWrite: boolean;
  companyName: string;
};

const requireOperatorOn = async (companyId: number, permission: 'users.read' | 'users.write') => {
  const authContext = await requireActionAuth();
  requireSystemUser(authContext);
  await requireActionPermission(permission, companyId);
  return authContext;
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Acceso of the console (ZIG-I38-6): the people and roles of the company in
 * the route. Writes below reuse the users actions with the company id, so the
 * role-rank guard (US009, US010, RL007) applies to every one of them.
 */
export async function getOperatorCompanyAccess(
  companyId: number,
): Promise<Result<OperatorAccessData>> {
  try {
    if (!Number.isInteger(companyId) || companyId < 1) return buildActionError('CO006');
    const authContext = await requireOperatorOn(companyId, 'users.read');

    const [userRows, roleRows, canWrite, companyRow] = await Promise.all([
      db.query.user.findMany({
        where: eq(user.company_id, companyId),
        with: { role: true },
        orderBy: [asc(user.name)],
      }),
      db.query.role.findMany({
        where: and(isNull(role.deleted_at), or(eq(role.company_id, companyId), isNull(role.company_id))),
        with: { permissions: { with: { permission: true } } },
        orderBy: [asc(role.name)],
      }),
      checkPermission(authContext.userId, companyId, 'users.write'),
      db.query.company.findFirst({
        where: (fields, { eq: eqFn }) => eqFn(fields.id, companyId),
        columns: { name: true },
      }),
    ]);

    const ids = userRows.map((row) => row.id);
    const emails = userRows.map((row) => row.email.toLowerCase());
    const [signIns, failures] = await Promise.all([
      ids.length
        ? db
            .select({ userId: auditEvent.actor_user_id, at: max(auditEvent.occurred_at) })
            .from(auditEvent)
            .where(and(eq(auditEvent.action, 'signed_in'), inArray(auditEvent.actor_user_id, ids)))
            .groupBy(auditEvent.actor_user_id)
        : Promise.resolve([]),
      emails.length
        ? db
            .select({ account: auditEvent.resource_id, total: sql<number>`count(*)::int` })
            .from(auditEvent)
            .where(
              and(
                eq(auditEvent.action, 'sign_in_failed'),
                inArray(auditEvent.resource_id, emails),
                gte(auditEvent.occurred_at, startOfToday()),
              ),
            )
            .groupBy(auditEvent.resource_id)
        : Promise.resolve([]),
    ]);
    const lastByUser = new Map(signIns.map((row) => [String(row.userId), row.at]));
    const failedByEmail = new Map(failures.map((row) => [row.account ?? '', Number(row.total)]));

    const members: OperatorAccessMember[] = userRows.map((row) => ({
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      roleId: row.role_id,
      roleName: row.role && !row.role.deleted_at ? row.role.name : null,
      createdAt: row.created_at.toISOString(),
      lastSignedInAt: lastByUser.get(row.id.toString())?.toISOString() ?? null,
      mustChangePassword: row.must_change_password,
      deactivated: row.deleted_at !== null,
      failedToday: failedByEmail.get(row.email.toLowerCase()) ?? 0,
    }));

    const activeByRole = new Map<number, number>();
    for (const member of members) {
      if (!member.deactivated && member.roleId != null) {
        activeByRole.set(member.roleId, (activeByRole.get(member.roleId) ?? 0) + 1);
      }
    }

    const roles: OperatorAccessRole[] = hideShadowedSharedRoles(roleRows).map((row) => {
      const names = row.permissions
        .map((assignment) => assignment.permission)
        .filter((perm): perm is NonNullable<typeof perm> => Boolean(perm && !perm.deleted_at))
        .map((perm) => perm.name);
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        shared: row.company_id == null,
        areas: describeRoleAreas(names),
        permissionCount: names.length,
        peopleCount: activeByRole.get(row.id) ?? 0,
      };
    });

    return {
      success: true,
      data: { members, roles, canWrite, companyName: companyRow?.name ?? '' },
    };
  } catch (error) {
    return handleCodedServerActionError('operator.access', 'US001', error);
  }
}

const findMember = async (companyId: number, id: string) => {
  let userId: bigint;
  try {
    userId = BigInt(id);
  } catch {
    return null;
  }
  return db.query.user.findFirst({
    where: and(eq(user.id, userId), eq(user.company_id, companyId), isNull(user.deleted_at)),
  });
};

export async function operatorChangeMemberRole(
  companyId: number,
  id: string,
  roleId: number,
): Promise<Result> {
  try {
    await requireOperatorOn(companyId, 'users.write');
    const existing = await findMember(companyId, id);
    if (!existing) return buildActionError('US003');
    const result = await updateUser(existing.id, {
      name: existing.name,
      email: existing.email,
      company_id: companyId,
      role_id: roleId,
    });
    return { success: result.success, error: result.error, errorType: result.errorType, errorCode: (result as Result).errorCode };
  } catch (error) {
    return handleCodedServerActionError('operator.access.role', 'US003', error);
  }
}

export async function operatorDeactivateMember(companyId: number, id: string): Promise<Result> {
  try {
    await requireOperatorOn(companyId, 'users.write');
    const existing = await findMember(companyId, id);
    if (!existing) return buildActionError('US004');
    const result = await deleteUser(existing.id, companyId);
    return { success: result.success, error: result.error, errorType: result.errorType, errorCode: (result as Result).errorCode };
  } catch (error) {
    return handleCodedServerActionError('operator.access.deactivate', 'US004', error);
  }
}

export async function operatorAddMember(
  companyId: number,
  data: { name: string; email: string; role_id: number },
): Promise<Result<{ temporaryPassword: string }>> {
  try {
    await requireOperatorOn(companyId, 'users.write');
    const temporaryPassword = generateTemporaryPassword();
    const result = await createUser({
      name: data.name,
      email: data.email,
      role_id: data.role_id,
      password: temporaryPassword,
      company_id: companyId,
      must_change_password: true,
    });
    if (!result.success) {
      return { success: false, error: result.error, errorType: result.errorType, errorCode: (result as Result).errorCode };
    }
    return { success: true, data: { temporaryPassword } };
  } catch (error) {
    return handleCodedServerActionError('operator.access.add', 'US002', error);
  }
}

