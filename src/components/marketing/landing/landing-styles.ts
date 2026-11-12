/**
 * Shared class strings for the "Papel y tinta" landing sections. Colours come
 * from the `--pt-*` tokens scoped to `.marketing-surface`; the app mock-ups
 * (cards, tables, phones) keep the app's own slate palette.
 */

export const FONT_DISPLAY = 'font-[family-name:var(--font-marketing-display)]';
export const FONT_MONO = 'font-[family-name:var(--font-marketing-mono)]';
export const FONT_SANS = 'font-[family-name:var(--font-marketing-sans)]';

/** Horizontal page gutter, same as the marketing shell. */
export const SECTION_X = 'px-4 sm:px-[clamp(16px,4vw,40px)]';

/** Mono uppercase kicker above a section title (14px on phones, 13px wide). */
export const KICKER = `m-0 ${FONT_MONO} text-sm font-medium uppercase tracking-[0.08em] text-[var(--pt-accent)] md:text-[13px]`;

export const SECTION_TITLE = `m-0 ${FONT_DISPLAY} text-[clamp(34px,4.6vw,62px)] leading-none font-extrabold tracking-[-0.035em]`;

export const SECTION_LEAD = 'text-[clamp(18px,1.5vw,20px)] text-[var(--pt-body)]';

/** White app card used as a "piece" next to marketing copy. */
export const APP_CARD =
  'rounded-[18px] border border-[#E2E8F0] bg-white text-sm text-[#0B1220] shadow-[0_22px_44px_-26px_rgba(23,20,15,0.45)]';

/** Amounts in the receipt voice. */
export const MONEY = `${FONT_MONO} whitespace-nowrap`;

/** Fixed MXN format the canvas uses: $1,200.00 */
export const formatMoney = (amount: number) =>
  `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
