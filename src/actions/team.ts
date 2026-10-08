'use server';

import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { role, user } from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { checkPermission, requireActionPermission } from '@/lib/security';
import { PERMISSIONS } from '@/lib/permissions';
import type { TeamMember, TeamRoleOption } from '@/lib/team-members';
import { createUser, deleteUser, updateUser } from '@/actions/users';

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  errorType?: ActionErrorType;
};

/** Drops the user row the core actions return; the client refetches the team. */
const withoutData = (result: ActionResult<unknown>): ActionResult =>
  result.success
    ? { success: true }
    : {
        success: false,
        error: result.error,
        errorCode: result.errorCode,
        errorType: result.errorType,
      };

export type TeamData = {
  members: TeamMember[];
  roles: TeamRoleOption[];
  canWrite: boolean;
};

const parseUserId = (id: string): bigint | null => {
  try {
    const parsed = BigInt(id);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Equipo tab (ZIG-I3-4): members and assignable roles of the caller's own
 * company. Never takes a company id, so it cannot be pointed at another tenant.
 */
export async function getTeam(): Promise<ActionResult<TeamData>> {
  try {
    const { context, companyId } = await requireActionPermission(
      PERMISSIONS.users.read,
    );

    const [rows, roleRows, canWrite] = await Promise.all([
      db.query.user.findMany({
        where: and(eq(user.company_id, companyId), isNull(user.deleted_at)),
        with: { role: true },
        orderBy: [asc(user.name)],
      }),
      db.query.role.findMany({
        where: and(
          isNull(role.deleted_at),
          or(eq(role.company_id, companyId), isNull(role.company_id)),
        ),
        orderBy: [asc(role.name)],
      }),
      checkPermission(context.userId, companyId, PERMISSIONS.users.write),
    ]);

    return {
      success: true,
      data: {
        members: rows.map((row) => ({
          id: row.id.toString(),
          name: row.name,
          email: row.email,
          roleId: row.role_id,
          roleName: row.role && !row.role.deleted_at ? row.role.name : null,
          emailVerified: Boolean(row.email_verified_at),
          createdAt: row.created_at.toISOString(),
          isSelf: row.id.toString() === context.userId,
        })),
        roles: roleRows.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
        })),
        canWrite,
      },
    };
  } catch (e) {
    return handleCodedServerActionError('team.get', 'US001', e);
  }
}

/** Loads a member of the caller's company; null when it belongs elsewhere or is gone. */
async function findOwnCompanyMember(id: string, companyId: number) {
  const userId = parseUserId(id);
  if (userId === null) {
    return null;
  }
  return db.query.user.findFirst({
    where: and(
      eq(user.id, userId),
      eq(user.company_id, companyId),
      isNull(user.deleted_at),
    ),
  });
}

export async function addTeamMember(data: {
  name: string;
  email: string;
  role_id: number;
  password: string;
}): Promise<ActionResult> {
  try {
    const { companyId } = await requireActionPermission(PERMISSIONS.users.write);
    const result = await createUser({ ...data, company_id: companyId });
    return withoutData(result);
  } catch (e) {
    return handleCodedServerActionError('team.add', 'US002', e);
  }
}

export async function updateTeamMember(
  id: string,
  data: { name: string; email: string },
): Promise<ActionResult> {
  try {
    const { companyId } = await requireActionPermission(PERMISSIONS.users.write);
    const existing = await findOwnCompanyMember(id, companyId);
    if (!existing) {
      return buildActionError('US003');
    }
    const result = await updateUser(existing.id, {
      name: data.name,
      email: data.email,
      company_id: companyId,
      role_id: existing.role_id ?? undefined,
    });
    return withoutData(result);
  } catch (e) {
    return handleCodedServerActionError('team.update', 'US003', e);
  }
}

export async function changeTeamMemberRole(
  id: string,
  roleId: number,
): Promise<ActionResult> {
  try {
    const { companyId } = await requireActionPermission(PERMISSIONS.users.write);
    const existing = await findOwnCompanyMember(id, companyId);
    if (!existing) {
      return buildActionError('US003');
    }
    const result = await updateUser(existing.id, {
      name: existing.name,
      email: existing.email,
      company_id: companyId,
      role_id: roleId,
    });
    return withoutData(result);
  } catch (e) {
    return handleCodedServerActionError('team.role', 'US003', e);
  }
}

export async function deactivateTeamMember(id: string): Promise<ActionResult> {
  try {
    const { companyId } = await requireActionPermission(PERMISSIONS.users.write);
    const existing = await findOwnCompanyMember(id, companyId);
    if (!existing) {
      return buildActionError('US004');
    }
    const result = await deleteUser(existing.id, companyId);
    return withoutData(result);
  } catch (e) {
    return handleCodedServerActionError('team.deactivate', 'US004', e);
  }
}
