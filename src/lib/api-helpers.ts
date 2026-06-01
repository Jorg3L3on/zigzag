import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  buildPublicError,
  type ActionErrorType,
} from '@/lib/errors';
import { isErrorCode, type ErrorCode } from '@/lib/error-catalog';
import { and, eq, isNull } from 'drizzle-orm';
import { user } from '@/db/schema';
import { db } from '@/lib/db';
import { companyAllowsAuthentication } from '@/lib/company-lifecycle';
import { checkPermission } from '@/lib/security';
import { resolveWritableCompanyId } from '@/lib/authz-context';
import { convertBigIntToString } from '@/lib/utils';
import { recordPermissionDeniedAudit } from '@/lib/audit-security';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data: convertBigIntToString(data) },
    { status },
  );
}

export function fail(
  error: string | ErrorCode,
  status = 400,
  errorType?: ActionErrorType,
) {
  if (isErrorCode(error)) {
    const payload = buildPublicError(error);
    return NextResponse.json(
      {
        success: false,
        ...payload,
        ...(errorType ? { errorType } : {}),
      },
      { status },
    );
  }

  const payload = buildPublicError('GN001', undefined, errorType);
  return NextResponse.json(
    { success: false, ...payload, ...(errorType ? { errorType } : {}) },
    { status },
  );
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { session: null, unauthorized: fail('AU001', 401) };
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
    return { session: null, unauthorized: fail('AU001', 401) };
  }

  session.user.company_id = activeUser.company_id ?? activeUser.company.id;
  session.user.company_name = activeUser.company.name;
  session.user.company_is_system = Boolean(activeUser.company.is_system);

  return { session, unauthorized: null };
}

export async function requireApiPermission(
  permissionName: string,
  requestedCompanyId?: number | null,
  requestMeta?: Record<string, unknown>,
) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized || !session) {
    return { session: null, companyId: null, unauthorized };
  }

  const actor = {
    userId: session.user.id,
    companyId: session.user.company_id ?? null,
    companyIsSystem: Boolean(session.user.company_is_system),
  };

  let companyId: number;
  try {
    companyId = resolveWritableCompanyId(actor, requestedCompanyId);
  } catch {
    await recordPermissionDeniedAudit({
      actor,
      targetCompanyId: requestedCompanyId ?? actor.companyId,
      permission: permissionName,
      source: 'api',
      reason: 'invalid_company_context',
      actorCompanyId: actor.companyId,
      requestedCompanyId: requestedCompanyId ?? null,
      requestMeta,
    });
    return {
      session: null,
      companyId: null,
      unauthorized: fail('AU002', 403, 'auth'),
    };
  }

  const allowed = await checkPermission(
    session.user.id,
    companyId,
    permissionName,
  );

  if (!allowed) {
    await recordPermissionDeniedAudit({
      actor,
      targetCompanyId: companyId,
      permission: permissionName,
      source: 'api',
      reason: 'missing_permission',
      actorCompanyId: actor.companyId,
      requestedCompanyId: requestedCompanyId ?? companyId,
      requestMeta,
    });
    return {
      session: null,
      companyId: null,
      unauthorized: fail('AU002', 403, 'auth'),
    };
  }

  return { session, companyId, unauthorized: null };
}
