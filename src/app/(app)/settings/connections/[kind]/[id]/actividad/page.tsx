import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Activity } from 'lucide-react';
import { auth } from '@/lib/auth';
import {
  getOwnedConnection,
  listMcpToolCalls,
  MCP_TOOL_CALL_RETENTION_DAYS,
  parseConnectionKind,
} from '@/lib/mcp/activity';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { activityPageHref, McpActivityRow } from '@/components/settings/mcp-activity-row';

const PAGE_SIZE = 50;

type Props = {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ antes?: string }>;
};

export default async function McpConnectionActivityPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }
  const userId = BigInt(session.user.id);

  const { kind: kindParam, id } = await params;
  const { antes } = await searchParams;
  const kind = parseConnectionKind(kindParam);
  const connectionId = Number(id);
  if (!kind) notFound();

  const connection = await getOwnedConnection(userId, kind, connectionId);
  if (!connection) notFound();

  const cursor = antes && /^\d+$/.test(antes) ? Number(antes) : null;
  const page = await listMcpToolCalls({
    userId,
    kind,
    connectionId,
    cursor,
    limit: PAGE_SIZE,
  });

  return (
    <TripledDashboardShell maxWidthClassName="max-w-3xl">
      <TripledPageHeader
        items={[
          { label: 'Conexiones', href: '/settings/connections' },
          { label: 'Actividad' },
        ]}
        className="hidden md:flex"
      />
      <TripledMobileAppBar
        title="Actividad"
        subtitle={connection.name}
        backHref="/settings/connections"
        className="mb-3"
      />
      <TripledResourceCard
        title={connection.name}
        description={`${kind === 'api_key' ? 'Llave de agente' : 'Conexión OAuth'}${
          connection.revoked ? ' (revocada)' : ''
        } · se guardan ${MCP_TOOL_CALL_RETENTION_DAYS} días`}
        icon={<Activity className="size-5" aria-hidden />}
      >
        {page.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {cursor ? 'No hay llamadas más antiguas.' : 'Sin actividad todavía.'}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {page.items.map((item) => (
              <McpActivityRow key={item.id} item={item} />
            ))}
          </ul>
        )}
        <nav className="mt-3 flex flex-wrap gap-x-4" aria-label="Páginas de actividad">
          {cursor ? (
            <Link
              href={activityPageHref(kind, connection.id)}
              className="flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Más recientes
            </Link>
          ) : null}
          {page.next_cursor ? (
            <Link
              href={`${activityPageHref(kind, connection.id)}?antes=${page.next_cursor}`}
              className="flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Más antiguas
            </Link>
          ) : null}
        </nav>
      </TripledResourceCard>
    </TripledDashboardShell>
  );
}
