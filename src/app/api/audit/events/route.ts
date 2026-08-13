import { fail, ok, requireSession } from '@/lib/api-helpers';
import { parseAuditListFilters } from '@/lib/audit-api-filters';
import { queryAuditEvents, searchAuditEvents } from '@/lib/audit-query';

export const dynamic = 'force-dynamic';

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
    const { search, filters } = parseAuditListFilters(url);

    const result = search.trim()
      ? await searchAuditEvents(search, filters)
      : await queryAuditEvents(filters);

    return ok(result);
  } catch (error) {
    console.error('[AUDIT_EVENTS_GET]', error);
    return fail('GN001', 500, 'server');
  }
}
