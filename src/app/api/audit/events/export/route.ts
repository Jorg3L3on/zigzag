import { fail, requireSession } from '@/lib/api-helpers';
import { parseAuditListFilters } from '@/lib/audit-api-filters';
import {
  formatAuditActionLabel,
  formatAuditResultLabel,
  formatAuditResourceTypeLabel,
  formatAuditSourceLabel,
} from '@/lib/audit-catalog';
import { formatAuditEventSummary } from '@/lib/audit-event-summary';
import { exportAuditEvents } from '@/lib/audit-query';
import { toCsv } from '@/lib/csv';

export const dynamic = 'force-dynamic';

const CSV_HEADERS = [
  'ID',
  'Cuándo',
  'Actor',
  'Empresa actor',
  'Empresa objetivo',
  'Recurso',
  'Acción',
  'Resultado',
  'Origen',
  'Resumen',
] as const;

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
    const { cursor: _cursor, limit: _limit, ...exportFilters } = filters;

    const items = await exportAuditEvents(search, exportFilters, 5000);
    const rows = items.map((item) => {
      const summary = formatAuditEventSummary(item);
      return {
        ID: item.id,
        Cuándo: item.occurred_at,
        Actor: item.actor_user_name ?? item.actor_user_id ?? '',
        'Empresa actor':
          item.actor_company_name ?? item.actor_company_id ?? '',
        'Empresa objetivo':
          item.target_company_name ?? item.target_company_id ?? '',
        Recurso: `${formatAuditResourceTypeLabel(item.resource_type)}${
          item.resource_id ? ` #${item.resource_id}` : ''
        }`,
        Acción: formatAuditActionLabel(item.action),
        Resultado: formatAuditResultLabel(item.result),
        Origen: formatAuditSourceLabel(item.source),
        Resumen: summary.title,
      };
    });

    const csv = `\uFEFF${toCsv([...CSV_HEADERS], rows)}`;
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="auditoria-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[AUDIT_EVENTS_EXPORT_GET]', error);
    return fail('GN001', 500, 'server');
  }
}
