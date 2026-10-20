'use client';

import * as React from 'react';
import Link from 'next/link';
import type { LastMcpActivity } from '@/lib/mcp/activity';
import { LastActivityLine } from '@/components/settings/mcp-activity-row';

type GrantSummary = {
  id: number;
  client_name: string;
  revoked_at: string | null;
  last_activity?: LastMcpActivity | null;
};

/**
 * Mi cuenta › Conexiones OAuth (ZIG-I23-8): the agents that can act for the
 * user, each with its `Última actividad`. Managing them stays in Conexiones.
 */
export const OAuthConnectionsCard = () => {
  const [grants, setGrants] = React.useState<GrantSummary[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/account/oauth-grants')
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: GrantSummary[]) => {
        if (!cancelled) setGrants(rows.filter((grant) => grant.revoked_at == null));
      })
      .catch(() => {
        if (!cancelled) setGrants([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-2 border-t border-border/60 pt-4" data-testid="account-oauth-grants">
      <h3 className="text-sm font-medium text-muted-foreground">Conexiones OAuth</h3>
      {grants == null ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : grants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay agentes conectados por OAuth.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {grants.map((grant) => (
            <li key={grant.id} className="flex min-h-11 flex-col justify-center py-2">
              <p className="text-sm font-medium">{grant.client_name}</p>
              <LastActivityLine activity={grant.last_activity ?? null} />
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/settings/connections"
        className="flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Administrar conexiones
      </Link>
    </div>
  );
};
