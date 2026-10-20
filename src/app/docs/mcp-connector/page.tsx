import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { readMcpCatalog } from '@/lib/mcp/registry-catalog';
import { cursorMcpConfig, MCP_CLIENTS } from '@/lib/mcp-clients';
import { MARKETING_INDEXABLE_METADATA } from '@/lib/marketing-routes';
import {
  getMcpResourceUrl,
  MCP_OAUTH_SCOPES,
} from '@/lib/server/mcp-oauth/config';

export const metadata: Metadata = {
  title: 'Conector MCP | ZigZag',
  description:
    'Cómo conectar ChatGPT, Grok, Claude y Cursor a ZigZag por MCP: URL, autenticación, herramientas, scopes y límites.',
  robots: MARKETING_INDEXABLE_METADATA,
};

/** Every scope a connection can hold; rows render only for scopes the server grants. */
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  read: 'Leer compañías, documentos (presupuestos, tickets, recibos), clientes, catálogo y buscar. Siempre incluido.',
  write:
    'Crear y editar documentos y clientes, convertir presupuestos y cambiar estados. Solo si lo marcas al autorizar.',
  payments:
    'Registrar pagos y cobros. Apagado por defecto; se concede aparte de la escritura.',
};

const sectionTitle =
  'font-[family-name:var(--font-marketing-display)] text-xl font-semibold tracking-tight text-[var(--mkt-ink)]';

const requestMcpUrl = async (): Promise<string> => {
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
  if (!host) return getMcpResourceUrl();
  const proto =
    headerStore.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}/api/mcp`;
};

export default async function McpConnectorDocsPage() {
  const [mcpUrl, catalog] = await Promise.all([requestMcpUrl(), readMcpCatalog()]);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-4 py-12 text-base leading-relaxed sm:px-6 sm:py-16">
        <p className="text-sm font-medium text-[var(--mkt-signal)]">
          <Link href="/" className="hover:underline">
            ZigZag
          </Link>
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
          Conector MCP
        </h1>
        <p className="mt-4 text-[var(--mkt-muted)]">
          Conecta ChatGPT, Grok, Claude o Cursor a tu cuenta de ZigZag para consultar y
          preparar presupuestos, tickets, recibos y clientes desde el chat. Cada conexión
          solo ve las compañías que tú autorizas.
        </p>

        <section className="mt-10" aria-labelledby="url">
          <h2 id="url" className={sectionTitle}>
            URL del conector
          </h2>
          <p className="mt-3 break-all rounded-md border border-[var(--mkt-line-strong)] bg-[var(--mkt-foam)] px-3 py-2 font-mono text-sm">
            {mcpUrl}
          </p>
          <p className="mt-2 text-[var(--mkt-muted)]">
            También responde en <span className="font-mono">/mcp</span>. Transporte Streamable
            HTTP; sin un token válido ninguna herramienta devuelve datos.
          </p>
        </section>

        <section className="mt-10 space-y-6" aria-labelledby="clientes">
          <h2 id="clientes" className={sectionTitle}>
            Conectar tu cliente
          </h2>
          {MCP_CLIENTS.map((client) => (
            <div key={client.id} data-testid={`docs-client-${client.id}`}>
              <h3 className="text-lg font-semibold">{client.name}</h3>
              <p className="mt-1 text-sm text-[var(--mkt-muted)]">{client.authLabel}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                {client.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {client.id === 'cursor' ? (
                <pre className="mt-3 overflow-x-auto rounded-md bg-[var(--mkt-foam)] p-3 font-mono text-sm">
                  {cursorMcpConfig(mcpUrl)}
                </pre>
              ) : null}
            </div>
          ))}
          <p className="text-[var(--mkt-muted)]">
            Las llaves <span className="font-mono">zigzag_…</span> se crean en ZigZag →
            Ajustes → Conexiones y se muestran una sola vez. Ahí mismo ves la última actividad
            de cada conexión y puedes revocarla.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="herramientas">
          <h2 id="herramientas" className={sectionTitle}>
            Herramientas
          </h2>
          <p className="mt-3 text-[var(--mkt-muted)]">
            Llama <span className="font-mono">whoami</span> primero. Las herramientas de
            escritura piden confirmación en el cliente antes de ejecutarse.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm" data-testid="docs-tools-table">
              <thead>
                <tr className="border-b border-[var(--mkt-line-strong)]">
                  <th className="py-2 pr-3 font-semibold">Herramienta</th>
                  <th className="py-2 pr-3 font-semibold">Tipo</th>
                  <th className="py-2 font-semibold">Qué hace</th>
                </tr>
              </thead>
              <tbody>
                {catalog.tools.map((tool) => (
                  <tr key={tool.name} className="border-b border-[var(--mkt-line)] align-top">
                    <td className="py-2 pr-3">
                      <span className="font-mono">{tool.name}</span>
                      <span className="block text-[var(--mkt-muted)]">{tool.title}</span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {tool.readOnly ? 'Lectura' : 'Escritura'}
                    </td>
                    <td className="py-2 text-[var(--mkt-muted)]">{tool.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {catalog.prompts.length > 0 ? (
            <>
              <h3 className="mt-6 text-lg font-semibold">Prompts listos</h3>
              <ul className="mt-2 space-y-1">
                {catalog.prompts.map((prompt) => (
                  <li key={prompt.name}>
                    <span className="font-mono">{prompt.name}</span>
                    {prompt.description ? (
                      <span className="text-[var(--mkt-muted)]"> — {prompt.description}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className="mt-10" aria-labelledby="scopes">
          <h2 id="scopes" className={sectionTitle}>
            Scopes
          </h2>
          <ul className="mt-3 space-y-2" data-testid="docs-scopes">
            {MCP_OAUTH_SCOPES.map((scope) => (
              <li key={scope}>
                <span className="font-mono font-semibold">{scope}</span>
                <span className="text-[var(--mkt-muted)]">
                  {' '}
                  — {SCOPE_DESCRIPTIONS[scope] ?? ''}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="limites">
          <h2 id="limites" className={sectionTitle}>
            Límites y seguridad
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--mkt-muted)]">
            <li>Cada conexión elige sus compañías; sin compañías no ve nada.</li>
            <li>120 llamadas por minuto por conexión.</li>
            <li>
              OAuth: el token de acceso dura 24 horas y se renueva solo; la conexión dura hasta
              un año desde que la autorizas. Las llaves vencen a los 365 días como máximo.
            </li>
            <li>
              Cambiar tu contraseña o desactivar tu cuenta revoca todas tus conexiones.
            </li>
            <li>Cada llamada queda en el registro de actividad de la conexión durante 90 días.</li>
          </ul>
        </section>
      </article>
    </MarketingShell>
  );
}
