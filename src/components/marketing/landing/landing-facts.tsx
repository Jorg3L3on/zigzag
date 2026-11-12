import type { ReactNode } from 'react';
import { FONT_MONO, FONT_SANS, SECTION_X } from './landing-styles';

const ICON = {
  viewBox: '0 0 24 24',
  width: 20,
  height: 20,
  'aria-hidden': true,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'shrink-0 text-[var(--pt-accent)]',
} as const;

const FACTS: { label: string; icon: ReactNode }[] = [
  {
    label: 'Sin tienda de apps',
    icon: (
      <svg {...ICON}>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M12 8v6M9.5 11.5L12 14l2.5-2.5" />
      </svg>
    ),
  },
  {
    label: 'Guarda tickets sin señal',
    icon: (
      <svg {...ICON}>
        <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.5M19 13a10 10 0 0 0-5-2.8M12 20h.01" />
      </svg>
    ),
  },
  {
    label: 'Recibo PDF con tu logo',
    icon: (
      <svg {...ICON}>
        <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />
      </svg>
    ),
  },
  {
    label: 'Texto grande con un toque',
    icon: (
      <span
        aria-hidden
        className={`${FONT_SANS} w-5 shrink-0 text-center text-[17px] leading-none font-bold text-[var(--pt-accent)]`}
      >
        Aa
      </span>
    ),
  },
];

/** ZIG-I39-3: four short facts between dashed rules, right under the hero. */
export const LandingFacts = () => (
  <section
    aria-label="En pocas palabras"
    className={`${SECTION_X} border-y-[1.5px] border-dashed border-[rgba(23,20,15,0.35)] py-[18px]`}
  >
    <ul
      className={`mx-auto flex max-w-[1180px] list-none flex-wrap justify-between gap-x-8 gap-y-3 p-0 ${FONT_MONO} text-sm font-medium`}
    >
      {FACTS.map((fact) => (
        <li key={fact.label} className="flex items-center gap-2.5">
          {fact.icon}
          {fact.label}
        </li>
      ))}
    </ul>
  </section>
);
