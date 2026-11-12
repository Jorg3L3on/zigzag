'use client';

import { useState } from 'react';
import { cursorMcpConfig, getMcpClient, type McpClientId } from '@/lib/mcp-clients';

/** Tab order on /ayuda/asistentes (the canvas order); steps come from mcp-clients. */
export const ASSISTANT_TAB_ORDER: McpClientId[] = ['chatgpt', 'claude', 'grok', 'cursor'];

const MONO = 'font-[family-name:var(--font-marketing-mono)]';

const fillUrl = (step: string, url: string) => step.replace('{url}', url);

/** 01: the connector URL and a Copiar button that turns into "Copiada". */
export const CopyConnectorUrl = ({ mcpUrl }: { mcpUrl: string }) => {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border-2 border-[var(--pt-ink)] bg-[var(--pt-paper)] py-2.5 pr-2.5 pl-5">
        <span
          className={`${MONO} min-w-0 flex-[1_1_260px] text-base [overflow-wrap:anywhere]`}
          data-testid="assistant-mcp-url"
        >
          {mcpUrl}
        </span>
        <button
          type="button"
          onClick={copy}
          className="min-h-12 min-w-[120px] flex-none cursor-pointer rounded-[10px] bg-[var(--pt-ink)] px-5 font-semibold text-[var(--pt-ground)]"
        >
          {state === 'copied' ? 'Copiada' : 'Copiar'}
        </button>
      </div>
      <p aria-live="polite" className="m-0 min-h-0 text-[15px] text-[var(--pt-muted)]">
        {state === 'copied' ? 'Dirección copiada.' : null}
        {state === 'failed' ? 'No se pudo copiar. Selecciona la dirección y cópiala a mano.' : null}
      </p>
    </div>
  );
};

/** 02: one tab per assistant; the card shows its auth line, steps and (Cursor) mcp.json. */
export const AssistantTabs = ({ mcpUrl }: { mcpUrl: string }) => {
  const [selected, setSelected] = useState<McpClientId>(ASSISTANT_TAB_ORDER[0]);
  const client = getMcpClient(selected);

  return (
    <div className="flex flex-col gap-3.5">
      <div role="group" aria-label="Asistente" className="flex flex-wrap gap-2">
        {ASSISTANT_TAB_ORDER.map((id) => {
          const on = id === selected;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => setSelected(id)}
              className={`min-h-12 cursor-pointer rounded-full border-[1.5px] px-5 text-base font-semibold ${
                on
                  ? 'border-[var(--pt-ink)] bg-[var(--pt-ink)] text-[var(--pt-ground)]'
                  : 'border-[rgba(23,20,15,0.4)] bg-transparent text-[var(--pt-ink)]'
              }`}
            >
              {getMcpClient(id).name}
            </button>
          );
        })}
      </div>
      <div
        className="flex flex-col gap-3.5 rounded-3xl border border-[rgba(23,20,15,0.14)] bg-[var(--pt-paper)] p-[clamp(20px,2.6vw,28px)]"
        data-testid={`docs-client-${client.id}`}
      >
        <span className="text-[15px] text-[var(--pt-muted)]">{client.authLabel}</span>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {client.steps.map((step, index) => (
            <li key={step} className="flex items-baseline gap-3.5">
              <span aria-hidden className={`${MONO} flex-none text-sm font-semibold text-[var(--pt-accent)]`}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0">{fillUrl(step, mcpUrl)}</span>
            </li>
          ))}
        </ol>
        {client.id === 'cursor' ? (
          <pre
            className={`${MONO} m-0 overflow-x-auto rounded-[14px] bg-[var(--pt-ink)] p-4 text-sm leading-[1.6] text-[var(--pt-ground)]`}
            data-testid="assistant-cursor-config"
          >
            {cursorMcpConfig(mcpUrl)}
          </pre>
        ) : null}
        <p className="m-0 text-[15px] text-[var(--pt-muted)]">
          Las llaves <span className={MONO}>zigzag_…</span> se crean en ZigZag → Ajustes →
          Conexiones y se muestran una sola vez. Ahí mismo ves la última actividad de cada
          conexión y puedes revocarla.
        </p>
      </div>
    </div>
  );
};
