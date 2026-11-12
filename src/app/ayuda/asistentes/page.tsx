import type { Metadata } from 'next';
import { AssistantTabs, CopyConnectorUrl } from '@/components/ayuda/assistant-connector';
import { HelpShell } from '@/components/ayuda/help-shell';
import { MCP_SCOPE_DESCRIPTIONS, requestMcpUrl } from '@/lib/mcp/connector-docs';
import { readMcpCatalog } from '@/lib/mcp/registry-catalog';
import { MARKETING_INDEXABLE_METADATA } from '@/lib/marketing-routes';
import { MCP_OAUTH_SCOPES } from '@/lib/server/mcp-oauth/config';

export const metadata: Metadata = {
  title: 'Conecta tu asistente | Ayuda ZigZag',
  description:
    'Cómo conectar ChatGPT, Claude, Grok y Cursor a ZigZag: la dirección del conector, los pasos de cada asistente, qué puede hacer, límites y herramientas.',
  robots: MARKETING_INDEXABLE_METADATA,
};

const MONO = 'font-[family-name:var(--font-marketing-mono)]';
const DISPLAY = 'font-[family-name:var(--font-marketing-display)]';
const H2 = `${DISPLAY} m-0 text-[clamp(24px,2.4vw,32px)] font-bold tracking-[-0.025em]`;
const STEP_NUMBER = `${MONO} text-sm font-semibold tracking-normal text-[var(--pt-accent)]`;

/** "03 Elige qué puede hacer": one card per scope, with the server's scope text. */
const SCOPE_CARDS: Record<string, { name: string; badge: string; badgeClass: string }> = {
  read: { name: 'Leer', badge: 'Siempre', badgeClass: 'bg-[#d1fae5] text-[#065f46]' },
  write: { name: 'Escribir', badge: 'Solo si lo marcas', badgeClass: 'bg-[#fef3c7] text-[#78350f]' },
  payments: { name: 'Cobros', badge: 'Apagado', badgeClass: 'bg-[#e2e8f0] text-[#334155]' },
};

const EXAMPLE_REQUESTS = [
  '¿A quién le tengo que cobrar hoy?',
  'Hazme un ticket con este mensaje del cliente.',
  '¿Cómo vamos con Plaza Comercial Aurora?',
];

const PlusIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden
    className="flex-none transition-transform group-open:rotate-45"
    fill="none"
    stroke="var(--pt-accent)"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * Connector page in the help centre (ZIG-I40-5): copy the address, paste it
 * into your assistant, choose what it can do; examples, limits, and the
 * server's tools and prompts for whoever sets it up. Public, no session.
 */
export default async function AyudaAsistentesPage() {
  const [mcpUrl, catalog] = await Promise.all([requestMcpUrl(), readMcpCatalog()]);

  return (
    <HelpShell>
      <div className="mx-auto box-border flex w-full max-w-[980px] flex-col gap-[clamp(36px,4.4vw,60px)] px-4 py-[clamp(32px,5vw,72px)] sm:px-[clamp(16px,4vw,40px)]">
        <div className="flex flex-col gap-3.5">
          <p className={`${MONO} m-0 text-sm font-medium tracking-[0.08em] text-[var(--pt-accent)] uppercase`}>
            Asistentes IA
          </p>
          <h1 className={`${DISPLAY} m-0 text-[clamp(40px,5.6vw,76px)] leading-[0.96] font-extrabold tracking-[-0.04em]`}>
            Conecta tu asistente
          </h1>
          <p className="m-0 max-w-[34em] text-[clamp(18px,1.5vw,21px)] text-[var(--pt-body)]">
            Conecta ChatGPT, Claude, Grok o Cursor a tu cuenta para consultar y preparar
            presupuestos, tickets, recibos y clientes desde el chat. Cada conexión solo ve las
            empresas que tú autorizas.
          </p>
        </div>

        <section aria-labelledby="zc-url" className="flex flex-col gap-3">
          <h2 id="zc-url" className={H2}>
            <span className={STEP_NUMBER}>01 </span>Copia esta dirección
          </h2>
          <CopyConnectorUrl mcpUrl={mcpUrl} />
        </section>

        <section aria-labelledby="zc-cliente" className="flex flex-col gap-3.5">
          <h2 id="zc-cliente" className={H2}>
            <span className={STEP_NUMBER}>02 </span>Pégala en tu asistente
          </h2>
          <AssistantTabs mcpUrl={mcpUrl} />
        </section>

        <section aria-labelledby="zc-permisos" className="flex flex-col gap-3.5">
          <h2 id="zc-permisos" className={H2}>
            <span className={STEP_NUMBER}>03 </span>Elige qué puede hacer
          </h2>
          <p className="m-0 text-[var(--pt-body)]">
            Lo eliges al autorizar la conexión en ZigZag.
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-4 p-0" data-testid="docs-scopes">
            {MCP_OAUTH_SCOPES.map((scope) => {
              const card = SCOPE_CARDS[scope];
              return (
                <li
                  key={scope}
                  className="flex min-w-0 flex-[1_1_250px] flex-col gap-2 rounded-3xl border border-[rgba(23,20,15,0.14)] bg-[var(--pt-paper)] p-[22px]"
                >
                  {card ? (
                    <span className={`self-start rounded-full px-2.5 py-0.5 text-sm font-semibold ${card.badgeClass}`}>
                      {card.badge}
                    </span>
                  ) : null}
                  <strong className={`${DISPLAY} text-[22px] font-bold tracking-[-0.02em]`}>
                    {card?.name ?? scope}{' '}
                    <span className={`${MONO} text-sm font-medium tracking-normal text-[var(--pt-muted)]`}>
                      ({scope})
                    </span>
                  </strong>
                  <span className="text-[15px] text-[var(--pt-body)]">
                    {MCP_SCOPE_DESCRIPTIONS[scope] ?? ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          aria-labelledby="zc-pedir"
          className="flex flex-col gap-4 rounded-[28px] bg-[var(--pt-ink)] p-[clamp(22px,3vw,36px)] text-[var(--pt-ground)]"
        >
          <h2 id="zc-pedir" className={H2}>
            Y ya puedes pedirle cosas
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
            {EXAMPLE_REQUESTS.map((request) => (
              <li
                key={request}
                className="rounded-[18px_18px_4px_18px] bg-[var(--pt-ground)] px-4 py-2.5 text-[var(--pt-ink)]"
              >
                {request}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="zc-limites" className="flex flex-col gap-3.5">
          <h2 id="zc-limites" className={H2}>
            Límites y seguridad
          </h2>
          <ul className="m-0 flex list-none flex-col p-0" data-testid="assistant-limits">
            {[
              'Cada conexión solo ve las empresas que elegiste al autorizar; sin empresas no ve nada.',
              '120 llamadas por minuto por conexión.',
              'OAuth: el token de acceso dura 24 horas y se renueva solo; la conexión dura hasta un año desde que la autorizas. Las llaves vencen a los 365 días como máximo.',
              'Cambiar tu contraseña o desactivar tu cuenta quita todas tus conexiones.',
              'Cada llamada queda en el registro de actividad de la conexión durante 90 días.',
            ].map((limit) => (
              <li
                key={limit}
                className="border-t border-[rgba(23,20,15,0.22)] py-3.5 last:border-b"
              >
                {limit}
              </li>
            ))}
          </ul>
        </section>

        <details className="group rounded-[20px] border-[1.5px] border-dashed border-[var(--pt-ink)] px-[clamp(16px,2.4vw,24px)] py-1">
          <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
            Para quien lo configura: herramientas
            <PlusIcon />
          </summary>
          <div className="flex flex-col gap-4 pb-4">
            <p className="m-0 text-[15px] text-[var(--pt-body)]">
              La dirección también responde en <span className={MONO}>/mcp</span>. Transporte
              Streamable HTTP; sin un token válido ninguna herramienta devuelve datos. Llama{' '}
              <span className={MONO}>whoami</span> primero. Las herramientas de escritura piden
              confirmación en el cliente antes de ejecutarse.
            </p>
            <div className="overflow-x-auto" data-testid="docs-tools-scroll">
              <table className="w-full min-w-[520px] border-collapse text-left text-[15px]" data-testid="docs-tools-table">
                <thead>
                  <tr className="border-b border-[var(--pt-ink)] text-sm text-[var(--pt-muted)]">
                    <th scope="col" className="py-2 pr-3 font-medium">Herramienta</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Tipo</th>
                    <th scope="col" className="py-2 font-medium">Qué hace</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.tools.map((tool) => (
                    <tr key={tool.name} className="border-b border-[rgba(23,20,15,0.18)] align-top">
                      <td className="py-2.5 pr-3">
                        <span className={MONO}>{tool.name}</span>
                        <span className="block text-[var(--pt-muted)]">{tool.title}</span>
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {tool.readOnly ? 'Lectura' : 'Escritura'}
                      </td>
                      <td className="py-2.5 text-[var(--pt-body)]">{tool.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {catalog.prompts.length > 0 ? (
              <>
                <h3 className="m-0 text-lg font-semibold">Prompts listos</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-left text-[15px]" data-testid="docs-prompts-table">
                    <thead>
                      <tr className="border-b border-[var(--pt-ink)] text-sm text-[var(--pt-muted)]">
                        <th scope="col" className="py-2 pr-3 font-medium">Prompt</th>
                        <th scope="col" className="py-2 font-medium">Qué hace</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalog.prompts.map((prompt) => (
                        <tr key={prompt.name} className="border-b border-[rgba(23,20,15,0.18)] align-top">
                          <td className={`${MONO} py-2.5 pr-3`}>{prompt.name}</td>
                          <td className="py-2.5 text-[var(--pt-body)]">{prompt.description ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </details>
      </div>
    </HelpShell>
  );
}
