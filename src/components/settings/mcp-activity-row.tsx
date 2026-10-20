import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import type {
  LastMcpActivity,
  McpConnectionKind,
  McpToolCallItem,
} from '@/lib/mcp/activity';

export const activityPageHref = (kind: McpConnectionKind, id: number) =>
  `/settings/connections/${kind}/${id}/actividad`;

const ERROR_LABELS: Record<string, string> = {
  unauthorized: 'Sin autorización',
  forbidden: 'Sin permiso',
  not_found: 'No encontrado',
  validation: 'Datos inválidos',
  rate_limited: 'Límite alcanzado',
  internal: 'Error interno',
};

export const toolCallStatusLabel = (ok: boolean, errorCode: string | null) =>
  ok ? 'Correcto' : (ERROR_LABELS[errorCode ?? ''] ?? 'Error');

export const relativeTime = (iso: string) =>
  formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: es });

/** `Última actividad: list_tickets · hace 5 minutos` on a connection card. */
export function LastActivityLine({ activity }: { activity: LastMcpActivity | null }) {
  return (
    <p className="text-caption text-muted-foreground" data-testid="mcp-last-activity">
      Última actividad:{' '}
      {activity ? (
        <>
          <span className="font-mono text-foreground">{activity.tool}</span>
          {activity.ok ? '' : ` (${toolCallStatusLabel(false, activity.error_code)})`} ·{' '}
          <time dateTime={activity.created_at}>{relativeTime(activity.created_at)}</time>
        </>
      ) : (
        'sin actividad todavía'
      )}
    </p>
  );
}

/** Tools that move money (ZIG-I23-7); their rows carry a Pago mark. */
export const PAYMENT_TOOLS = new Set(['register_payment']);

/** One tool call, 44px tall at least so it reads and taps well on a phone. */
export function McpActivityRow({ item }: { item: McpToolCallItem }) {
  return (
    <li
      className="flex min-h-11 items-center justify-between gap-3 py-2"
      data-testid="mcp-activity-row"
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-mono text-sm">
          <span className="truncate">{item.tool}</span>
          {PAYMENT_TOOLS.has(item.tool) ? (
            <Badge variant="outline" className="shrink-0 font-sans" data-testid="mcp-activity-payment">
              Pago
            </Badge>
          ) : null}
        </p>
        <p className="flex gap-1 text-caption text-muted-foreground">
          <span className="truncate">{item.company_name ?? 'Sin compañía'}</span>
          <span aria-hidden>·</span>
          <time dateTime={item.created_at} className="shrink-0">
            {relativeTime(item.created_at)}
          </time>
        </p>
      </div>
      <Badge
        variant={item.ok ? 'secondary' : 'destructive'}
        className="shrink-0"
        title={item.error_code ?? undefined}
      >
        {toolCallStatusLabel(item.ok, item.error_code)}
      </Badge>
    </li>
  );
}
