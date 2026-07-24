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
import { checkRateLimit, type RateLimitOptions } from '@/lib/rate-limiter';
import {
  REQUEST_ID_HEADER,
  bindRequestContextFromHeaders,
  getRequestId,
} from '@/lib/request-context';

/** Default budget for authenticated API writes: generous, abuse-stopping. */
const DEFAULT_API_RATE_LIMIT: RateLimitOptions = {
  limit: 240,
  windowMs: 60_000,
};

/**
 * Enforce a rate limit for an API caller. Returns a 429 `fail()` response when
 * the budget is exceeded, otherwise null. Fails open if the backend is down.
 */
export async function enforceApiRateLimit(
  identifier: string,
  options: RateLimitOptions = DEFAULT_API_RATE_LIMIT,
) {
  const allowed = await checkRateLimit(identifier, options);
  if (!allowed) {
    return fail('GN004', 429);
  }
  return null;
}

const attachRequestIdHeader = (response: NextResponse): NextResponse => {
  const requestId = getRequestId();
  if (requestId) {
    response.headers.set(REQUEST_ID_HEADER, requestId);
  }
  return response;
};

export function ok<T>(data: T, status = 200) {
  return attachRequestIdHeader(
    NextResponse.json(
      { success: true, data: convertBigIntToString(data) },
      { status },
    ),
  );
}

export function fail(
  error: string | ErrorCode,
  status = 400,
  errorType?: ActionErrorType,
) {
  if (isErrorCode(error)) {
    const payload = buildPublicError(error);
    return attachRequestIdHeader(
      NextResponse.json(
        {
          success: false,
          ...payload,
          ...(errorType ? { errorType } : {}),
        },
        { status },
      ),
    );
  }

  const payload = buildPublicError('GN001', undefined, errorType);
  return attachRequestIdHeader(
    NextResponse.json(
      { success: false, ...payload, ...(errorType ? { errorType } : {}) },
      { status },
    ),
  );
}

export async function requireSession() {
  await bindRequestContextFromHeaders();
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

  const tokenVersion =
    (session.user as { token_version?: number }).token_version ?? 0;
  if (tokenVersion !== (activeUser.token_version ?? 0)) {
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

  const rateLimited = await enforceApiRateLimit(`api:user:${session.user.id}`);
  if (rateLimited) {
    return { session: null, companyId: null, unauthorized: rateLimited };
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
