'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { McpConnectionKind, McpToolCallPage } from '@/lib/mcp/activity';
import { activityPageHref, McpActivityRow } from '@/components/settings/mcp-activity-row';

/** Expandable list of a connection's last 20 tool calls, loaded on open. */
export function McpActivityList({
  kind,
  connectionId,
}: {
  kind: McpConnectionKind;
  connectionId: number;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<McpToolCallPage | null>(null);
  const [error, setError] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || page) return;
    setError(false);
    try {
      const response = await fetch(
        `/api/account/mcp-activity?kind=${kind}&id=${connectionId}&limit=20`,
      );
      if (!response.ok) throw new Error(String(response.status));
      setPage((await response.json()) as McpToolCallPage);
    } catch {
      setError(true);
    }
  };

  const listId = `mcp-activity-${kind}-${connectionId}`;

  return (
    <div className="w-full">
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-full justify-between px-2"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggle}
      >
        Actividad reciente
        {open ? (
          <ChevronUp className="size-4" aria-hidden />
        ) : (
          <ChevronDown className="size-4" aria-hidden />
        )}
      </Button>
      {open ? (
        <div id={listId} className="px-2">
          {error ? (
            <p className="py-2 text-sm text-destructive">No se pudo cargar la actividad.</p>
          ) : !page ? (
            <p className="py-2 text-sm text-muted-foreground">Cargando…</p>
          ) : page.items.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Este agente no ha usado ninguna herramienta todavía.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border/60">
                {page.items.map((item) => (
                  <McpActivityRow key={item.id} item={item} />
                ))}
              </ul>
              <Link
                href={activityPageHref(kind, connectionId)}
                className="flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Ver todo
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
