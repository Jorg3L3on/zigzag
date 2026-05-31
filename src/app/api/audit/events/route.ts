import { fail, ok, requireSession } from '@/lib/api-helpers';
import { queryAuditEvents, searchAuditEvents } from '@/lib/audit-query';

export const dynamic = 'force-dynamic';

const parseOptionalInt = (value: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export async function GET(request: Request) {
  try {
    const { session, unauthorized } = await requireSession();
    if (unauthorized || !session) {
      return unauthorized;
    }

    if (!session.user.company_is_system) {
      return fail('AU002', 403, 'auth');
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search') ?? '';
    const filters = {
      targetCompanyId: parseOptionalInt(url.searchParams.get('target_company_id')),
      actorUserId: url.searchParams.get('actor_user_id') ?? undefined,
      resourceType: url.searchParams.get('resource_type') ?? undefined,
      resourceId: url.searchParams.get('resource_id') ?? undefined,
      action: url.searchParams.get('action') ?? undefined,
      result: url.searchParams.get('result') ?? undefined,
      from: url.searchParams.get('from')
        ? new Date(url.searchParams.get('from') as string)
        : undefined,
      to: url.searchParams.get('to')
        ? new Date(url.searchParams.get('to') as string)
        : undefined,
      cursor: parseOptionalInt(url.searchParams.get('cursor')),
      limit: parseOptionalInt(url.searchParams.get('limit')),
    };

    const result = search.trim()
      ? await searchAuditEvents(search, filters)
      : await queryAuditEvents(filters);

    return ok(result);
  } catch (error) {
    console.error('[AUDIT_EVENTS_GET]', error);
    return fail('GN001', 500, 'server');
  }
}
