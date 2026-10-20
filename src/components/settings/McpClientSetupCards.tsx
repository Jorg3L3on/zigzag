'use client';

import { CheckCircle2, CircleDashed, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { relativeTime } from '@/components/settings/mcp-activity-row';
import type { WhoamiByClient } from '@/lib/mcp/client-whoami';
import { cursorMcpConfig, MCP_CLIENTS, type McpClientInfo } from '@/lib/mcp-clients';

const copyToClipboard = async (value: string, message: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  } catch {
    toast.error('No se pudo copiar. Copia el texto manualmente.');
  }
};

const fillUrl = (step: string, url: string) => step.replace('{url}', url);

function ProbarRow({ client, whoami }: { client: McpClientInfo; whoami: WhoamiByClient[keyof WhoamiByClient] }) {
  return (
    <div
      className="flex min-h-11 items-start gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm"
      data-testid={`mcp-client-probar-${client.id}`}
    >
      {whoami ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <p>
        <span className="font-medium">Probar: </span>
        {whoami ? (
          <>
            último <span className="font-mono">whoami</span>{' '}
            <time dateTime={whoami.at}>{relativeTime(whoami.at)}</time>
            {whoami.connection ? ` · ${whoami.connection}` : ''}
          </>
        ) : (
          <>
            pídele a {client.name} «llama whoami de ZigZag». Aún no hay un{' '}
            <span className="font-mono">whoami</span> desde {client.name}.
          </>
        )}
      </p>
    </div>
  );
}

type McpClientSetupCardsProps = {
  mcpUrl: string;
  whoami: WhoamiByClient;
};

/** One setup card per supported client: URL, steps, auth path and a test row. */
export function McpClientSetupCards({ mcpUrl, whoami }: McpClientSetupCardsProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/60 p-3">
        <p className="text-sm font-medium">URL del conector</p>
        <p className="mt-1 break-all font-mono text-sm text-muted-foreground" data-testid="mcp-url">
          {mcpUrl}
        </p>
      </div>
      {MCP_CLIENTS.map((client) => (
        <section
          key={client.id}
          aria-labelledby={`mcp-client-${client.id}`}
          className="space-y-3 rounded-xl border border-border/60 p-3"
          data-testid={`mcp-client-card-${client.id}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id={`mcp-client-${client.id}`} className="text-base font-semibold">
              {client.name}
            </h3>
            <Badge variant={client.auth === 'oauth' ? 'secondary' : 'outline'}>
              {client.auth === 'oauth' ? 'OAuth' : 'Llave zigzag_…'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{client.authLabel}</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {client.steps.map((step) => (
              <li key={step}>{fillUrl(step, mcpUrl)}</li>
            ))}
          </ol>
          {client.id === 'cursor' ? (
            <div className="space-y-2">
              <pre
                className="overflow-x-auto rounded-xl bg-muted p-3 font-mono text-sm"
                data-testid="cursor-mcp-json"
              >
                {cursorMcpConfig(mcpUrl)}
              </pre>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full sm:w-auto"
                onClick={() => copyToClipboard(cursorMcpConfig(mcpUrl), 'Configuración copiada')}
              >
                <Copy className="mr-2 size-4" aria-hidden />
                Copiar mcp.json
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={() => copyToClipboard(mcpUrl, 'URL copiada')}
              aria-label={`Copiar URL para ${client.name}`}
            >
              <Copy className="mr-2 size-4" aria-hidden />
              Copiar URL
            </Button>
          )}
          <ProbarRow client={client} whoami={whoami[client.id]} />
        </section>
      ))}
      <p className="text-sm text-muted-foreground">
        Guía completa:{' '}
        <a href="/docs/mcp-connector" className="underline underline-offset-2">
          /docs/mcp-connector
        </a>
      </p>
    </div>
  );
}
