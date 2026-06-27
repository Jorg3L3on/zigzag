import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { permission, role, rolePermission, user } from '@/db/schema';
import { db } from './db';
import { AuthorizationError } from './errors';
import { companyAllowsAuthentication } from '@/lib/company-lifecycle';
import { auth } from './auth';
import {
  resolveWritableCompanyId,
  requireSystemUser,
  type ActionAuthContext,
} from './authz-context';
import { recordPermissionDeniedAudit } from '@/lib/audit-security';
export {
  resolveWritableCompanyId,
  requireSystemUser,
  type ActionAuthContext,
} from './authz-context';

// Permission checking
export async function checkPermission(
  userId: string,
  companyId: number,
  permissionName?: string,
): Promise<boolean> {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new AuthorizationError('User not authenticated');
    }

    const userIdAsBigInt = BigInt(userId);
    const userRow = await db.query.user.findFirst({
      where: and(eq(user.id, userIdAsBigInt), isNull(user.deleted_at)),
      with: {
        company: true,
      },
    });

    if (
      !userRow?.company ||
      userRow.company.deleted_at ||
      !companyAllowsAuthentication(userRow.company.status)
    ) {
      return false;
    }

    // Persisted System company users are the root exception.
    if (userRow.company.is_system) {
      return true;
    }

    // Regular users can only receive permissions inside their own company.
    if (userRow.company_id !== companyId) {
      return false;
    }

    if (!userRow?.role_id) {
      return false;
    }

    const roleRow = await db.query.role.findFirst({
      where: and(eq(role.id, userRow.role_id), isNull(role.deleted_at)),
    });

    if (!roleRow) {
      return false;
    }

    // The assigned role must belong to the user's company (or be a global role).
    // Prevents a role from another tenant granting permissions here.
    if (roleRow.company_id !== null && roleRow.company_id !== userRow.company_id) {
      return false;
    }

    if (!permissionName) {
      return true;
    }

    const permissionRows = await db
      .select({ id: permission.id })
      .from(permission)
      .where(
        and(
          eq(permission.name, permissionName),
          isNull(permission.deleted_at),
          or(eq(permission.company_id, companyId), isNull(permission.company_id)),
        ),
      );

    if (permissionRows.length === 0) {
      return false;
    }

    const permitted = await db
      .select({ role_id: rolePermission.role_id })
      .from(rolePermission)
      .where(
        and(
          eq(rolePermission.role_id, userRow.role_id),
          inArray(
            rolePermission.permission_id,
            permissionRows.map((row) => row.id),
          ),
        ),
      )
      .limit(1);

    return permitted.length > 0;
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}

// Company access validation
export async function validateCompanyAccess(companyId: number): Promise<void> {
  const context = await requireActionAuth();

  if (context.companyIsSystem) {
    return;
  }

  if (context.companyId !== companyId) {
    throw new AuthorizationError('Access denied to this company');
  }
}

export async function requireActionAuth(): Promise<ActionAuthContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthorizationError('Authentication required');
  }

  const activeUser = await db.query.user.findFirst({
    where: and(eq(user.id, BigInt(session.user.id)), isNull(user.deleted_at)),
    with: {
      company: true,
    },
  });

  if (
    !activeUser?.company ||
    activeUser.company.deleted_at ||
    !companyAllowsAuthentication(activeUser.company.status)
  ) {
    throw new AuthorizationError('Authentication required');
  }

  // Reject JWTs minted before a session-invalidating change (password/role
  // change, soft-delete). Older tokens that predate the column default to 0.
  const tokenVersion =
    (session.user as { token_version?: number }).token_version ?? 0;
  if (tokenVersion !== (activeUser.token_version ?? 0)) {
    throw new AuthorizationError('Session expired');
  }

  return {
    userId: session.user.id,
    companyId: activeUser.company_id ?? null,
    companyIsSystem: Boolean(activeUser.company.is_system),
  };
}

export async function requireActionPermission(
  permissionName: string,
  requestedCompanyId?: number | null,
): Promise<{ context: ActionAuthContext; companyId: number }> {
  const context = await requireActionAuth();
  let companyId: number;
  try {
    companyId = resolveWritableCompanyId(context, requestedCompanyId);
  } catch (error) {
    await recordPermissionDeniedAudit({
      actor: context,
      targetCompanyId: requestedCompanyId ?? context.companyId,
      permission: permissionName,
      source: 'action',
      reason: 'invalid_company_context',
      actorCompanyId: context.companyId,
      requestedCompanyId: requestedCompanyId ?? null,
    });
    throw error;
  }

  const allowed = await checkPermission(context.userId, companyId, permissionName);

  if (!allowed) {
    await recordPermissionDeniedAudit({
      actor: context,
      targetCompanyId: companyId,
      permission: permissionName,
      source: 'action',
      reason: 'missing_permission',
      actorCompanyId: context.companyId,
      requestedCompanyId: requestedCompanyId ?? companyId,
    });
    throw new AuthorizationError(`Missing permission: ${permissionName}`);
  }

  return { context, companyId };
}
