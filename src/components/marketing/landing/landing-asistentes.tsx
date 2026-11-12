'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { MCP_DOCS_PATH } from '@/lib/marketing-routes';

/**
 * Text colours on the dark band (#17140F, --pt-ink), WCAG contrast against it:
 * cream 16.04:1, soft 12.02:1, quiet 8.39:1, amber 10.19:1 (all ≥ 4.5:1; on
 * the #221E18 chat card: 14.47, 10.85, 7.57, 9.19).
 */
const ON_DARK = {
  cream: 'text-[var(--pt-ground)]',
  soft: 'text-[#D9D0C1]',
  quiet: 'text-[#B8AE9F]',
  amber: 'text-[var(--pt-orange-from)]',
} as const;

const MONO = 'font-[family-name:var(--font-marketing-mono)]';

type ChatRow = { label: ReactNode; amount: ReactNode };

type Conversation = {
  prompt: string;
  question: string;
  intro: string;
  card:
    | { kind: 'rows'; rows: ChatRow[] }
    | { kind: 'ticket'; client: string; line: string; amount: string; status: string };
  closing: string;
};

export const ASISTENTES_CONVERSATIONS: readonly Conversation[] = [
  {
    prompt: 'Cobranza de hoy',
    question: '¿A quién le tengo que cobrar hoy?',
    intro: 'Tienes 4 saldos pendientes por $5,650.00. Los tres más atrasados:',
    card: {
      kind: 'rows',
      rows: [
        {
          label: (
            <>
              <strong className="font-semibold">Restaurante Mar &amp; Tierra</strong> · 34 días
            </>
          ),
          amount: '$2,100.00',
        },
        {
          label: (
            <>
              <strong className="font-semibold">Sra. Lupita</strong> · 21 días
            </>
          ),
          amount: '$1,200.00',
        },
        {
          label: (
            <>
              <strong className="font-semibold">Gimnasio FitPro</strong> · 9 días
            </>
          ),
          amount: '$1,350.00',
        },
      ],
    },
    closing: 'Empieza por Mar & Tierra: es el más atrasado.',
  },
  {
    prompt: 'Ticket desde un mensaje',
    question:
      'Me escribió el del hotel: “¿pueden venir a revisar dos minisplits que no enfrían?”. Hazme el ticket.',
    intro: 'Listo. Lo dejé preparado para que lo revises:',
    card: {
      kind: 'ticket',
      client: 'Hotel Riviera Dorada',
      line: 'Diagnóstico técnico × 2',
      amount: '$640.00',
      status: 'En proceso · sin cobro todavía',
    },
    closing: '¿Lo guardo así o le cambias algo?',
  },
  {
    prompt: 'Resumen de un cliente',
    question: '¿Cómo vamos con Plaza Comercial Aurora?',
    intro: 'Este año lleva 8 tickets por $38,400.00.',
    card: {
      kind: 'rows',
      rows: [
        { label: 'Pagado', amount: '$37,400.00' },
        {
          label: <strong className="font-semibold">Saldo</strong>,
          amount: <strong className="font-semibold">$1,000.00</strong>,
        },
        { label: 'Próximo mantenimiento', amount: '3 de diciembre' },
      ],
    },
    closing: 'El saldo es de la impermeabilización del 7 de noviembre.',
  },
];

const ChatCard = ({ card }: { card: Conversation['card'] }) => {
  if (card.kind === 'ticket') {
    return (
      <div className="flex flex-col gap-1.5 rounded-[14px] bg-[var(--pt-paper)] px-3.5 py-3 text-sm text-[var(--pt-ink)]">
        <strong className="text-[15px] font-semibold">{card.client}</strong>
        <div className="flex items-baseline justify-between gap-2.5">
          <span>{card.line}</span>
          <span className={`${MONO} whitespace-nowrap`}>{card.amount}</span>
        </div>
        <span className="flex items-center gap-1.5 text-sm text-[var(--pt-body)]">
          <span aria-hidden className="size-2 rounded-full bg-[#0EA5E9]" />
          {card.status}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-[14px] bg-[var(--pt-paper)] px-3.5 py-1 text-sm text-[var(--pt-ink)]">
      {card.rows.map((row, index) => (
        <div
          key={index}
          className={`flex items-baseline justify-between gap-2.5 py-2.5 ${
            index < card.rows.length - 1 ? 'border-b border-dashed border-[rgba(23,20,15,0.3)]' : ''
          }`}
        >
          <span>{row.label}</span>
          <span className={`${MONO} whitespace-nowrap`}>{row.amount}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * Landing "Asistentes IA" band: three example prompts switch the chat shown.
 * Assistant names are plain text (no logos).
 */
export const LandingAsistentes = () => {
  const [active, setActive] = useState(0);
  const chat = ASISTENTES_CONVERSATIONS[active];

  return (
    <section
      id="asistentes"
      aria-labelledby="asistentes-titulo"
      className={`zz-edge-y bg-[var(--pt-ink)] px-4 py-[clamp(78px,9vw,134px)] sm:px-[clamp(16px,4vw,40px)] ${ON_DARK.cream}`}
    >
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-start gap-[clamp(32px,5vw,72px)]">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5">
          <p
            className={`${MONO} text-sm font-medium tracking-[0.08em] uppercase ${ON_DARK.amber}`}
          >
            Asistentes IA
          </p>
          <h2
            id="asistentes-titulo"
            className="font-[family-name:var(--font-marketing-display)] text-[clamp(34px,4.6vw,62px)] leading-none font-extrabold tracking-[-0.035em]"
          >
            Pregúntale a tu negocio.
          </h2>
          <p className={`max-w-[30em] text-[clamp(18px,1.5vw,20px)] ${ON_DARK.soft}`}>
            Conecta ZigZag con ChatGPT, Claude o Grok y pide las cosas como se las
            pedirías a alguien de la oficina.
          </p>
          <div
            role="group"
            aria-label="Ejemplos de lo que puedes pedir"
            className="mt-2 flex flex-col gap-2"
          >
            {ASISTENTES_CONVERSATIONS.map((conversation, index) => {
              const pressed = index === active;
              return (
                <button
                  key={conversation.prompt}
                  type="button"
                  aria-pressed={pressed}
                  aria-controls="asistentes-chat"
                  onClick={() => setActive(index)}
                  className={`flex min-h-[52px] cursor-pointer items-center gap-3.5 rounded-[14px] border-[1.5px] px-[18px] text-left text-base font-semibold ${
                    pressed
                      ? 'border-[var(--pt-ground)] bg-[var(--pt-ground)] text-[var(--pt-ink)]'
                      : 'border-[rgba(244,239,230,0.35)] bg-transparent text-[var(--pt-ground)] hover:border-[rgba(244,239,230,0.6)]'
                  }`}
                >
                  <span aria-hidden className={`${MONO} text-sm font-medium`}>
                    {`0${index + 1}`}
                  </span>
                  {conversation.prompt}
                </button>
              );
            })}
          </div>
          <p className={`max-w-[32em] text-sm ${ON_DARK.quiet}`}>
            Tú decides qué empresas puede ver y si puede crear tickets. Cada consulta
            queda registrada.
          </p>
          <Link
            href={MCP_DOCS_PATH}
            className={`inline-flex min-h-11 items-center self-start font-semibold underline underline-offset-[5px] ${ON_DARK.amber} hover:text-[var(--pt-ground)]`}
          >
            Ver cómo se conecta
          </Link>
        </div>

        <div
          id="asistentes-chat"
          className="flex min-w-0 flex-[1.1_1_420px] flex-col gap-4 rounded-[28px] border border-[rgba(244,239,230,0.16)] bg-[#221E18] p-[clamp(18px,2.4vw,28px)] text-[15px]"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[rgba(244,239,230,0.14)] pb-3.5">
            <strong className="font-semibold">Tu asistente</strong>
            <span className={`inline-flex items-center gap-2 text-sm ${ON_DARK.quiet}`}>
              <span aria-hidden className="size-2 rounded-full bg-[#6EE7B7]" />
              Conectado a ZigZag
            </span>
          </div>
          <div
            aria-live="polite"
            data-testid="asistentes-conversation"
            className="flex flex-col gap-3.5"
          >
            <p className="max-w-[85%] self-end rounded-[18px_18px_4px_18px] bg-[var(--pt-ground)] px-3.5 py-2.5 text-[var(--pt-ink)]">
              {chat.question}
            </p>
            <div className="flex max-w-[94%] flex-col gap-2.5">
              <p>{chat.intro}</p>
              <ChatCard card={chat.card} />
              <p className={ON_DARK.soft}>{chat.closing}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
