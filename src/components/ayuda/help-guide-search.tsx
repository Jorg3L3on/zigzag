'use client';

import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import { filterHelpCards, type HelpCard } from '@/components/ayuda/guide-registry';

type HelpGuideSearchProps = {
  cards: HelpCard[];
  /** The no-match message points to WhatsApp only when the band is shown. */
  hasWhatsApp: boolean;
};

const ArrowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden
    className="shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const SECTION_PAD = 'px-4 sm:px-[clamp(16px,4vw,40px)]';
const SECTION_TITLE =
  'm-0 font-[family-name:var(--font-marketing-display)] text-[clamp(28px,3.2vw,44px)] leading-[1.02] font-extrabold tracking-[-0.03em]';

/**
 * /ayuda title, search field and "Quiero…" cards (ZIG-I40-1). The search sits
 * in the hero and filters the cards below it as you type; the first-steps band
 * is passed in between so both halves share the query state.
 */
export const HelpGuideSearch = ({
  cards,
  hasWhatsApp,
  between,
}: HelpGuideSearchProps & { between?: ReactNode }) => {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const visible = filterHelpCards(cards, query);

  return (
    <>
      <section className={`${SECTION_PAD} pt-[clamp(40px,5vw,72px)] pb-[clamp(40px,5vw,64px)]`}>
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
          <h1 className="m-0 font-[family-name:var(--font-marketing-display)] text-[clamp(44px,7vw,100px)] leading-[0.95] font-extrabold tracking-[-0.045em]">
            ¿Cómo se <span className="text-[var(--pt-accent)]">usa?</span>
          </h1>
          <p className="m-0 max-w-[34em] text-[clamp(18px,1.5vw,21px)] text-[var(--pt-body)]">
            Guías cortas, paso a paso, con las mismas pantallas que ves en tu teléfono.
          </p>
          <div className="mt-2 flex max-w-[620px] flex-col gap-2">
            <label
              htmlFor={inputId}
              className="font-[family-name:var(--font-marketing-mono)] text-sm font-medium uppercase tracking-[0.08em] text-[var(--pt-muted)]"
            >
              Busca una guía
            </label>
            <input
              id={inputId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ej. anticipo, recibo, sin señal"
              aria-controls={`${inputId}-results`}
              className="h-[60px] w-full min-w-0 rounded-2xl border-2 border-[var(--pt-ink)] bg-[var(--pt-paper)] px-5 text-[19px] text-[var(--pt-ink)] placeholder:text-[var(--pt-muted)]"
            />
          </div>
        </div>
      </section>

      {between}

      <section
        aria-labelledby={`${inputId}-quiero`}
        className={`${SECTION_PAD} py-[clamp(48px,6vw,88px)]`}
      >
        <div className="mx-auto max-w-[1180px]">
          <h2 id={`${inputId}-quiero`} className={`${SECTION_TITLE} mb-7`}>
            Quiero…
          </h2>
          <ul
            id={`${inputId}-results`}
            aria-label="Guías"
            className="m-0 flex list-none flex-wrap gap-4 p-0"
          >
            {visible.map((card) => (
              <li key={card.key} className="flex min-w-0 flex-[1_1_260px]">
                <Link
                  href={card.href}
                  className="flex min-h-[104px] w-full flex-col justify-between gap-2.5 rounded-[20px] border border-[rgba(23,20,15,0.16)] bg-[var(--pt-paper)] px-5 py-[18px] text-[var(--pt-ink)] no-underline hover:border-[var(--pt-ink)] hover:text-[var(--pt-accent)]"
                >
                  <span className="font-[family-name:var(--font-marketing-mono)] text-sm font-medium uppercase tracking-[0.08em] text-[var(--pt-accent)]">
                    {card.group}
                  </span>
                  <span className="flex items-end justify-between gap-3">
                    <strong className="text-[19px] leading-[1.25] font-semibold">{card.title}</strong>
                    <ArrowIcon />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p role="status" className="mt-2 text-[19px] text-[var(--pt-body)] empty:hidden">
            {visible.length > 0
              ? null
              : cards.length === 0
                ? 'Pronto habrá guías aquí.'
                : hasWhatsApp
                  ? 'No hay una guía con esas palabras. Prueba con otra o escríbenos por WhatsApp.'
                  : 'No hay una guía con esas palabras. Prueba con otra.'}
          </p>
        </div>
      </section>
    </>
  );
};
