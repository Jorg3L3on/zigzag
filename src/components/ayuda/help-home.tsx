import { HelpGuideSearch } from '@/components/ayuda/help-guide-search';
import { HelpShell } from '@/components/ayuda/help-shell';
import type { HelpCard } from '@/components/ayuda/guide-registry';

/** "Tus primeros cinco minutos" on /ayuda (copy from the canvas). */
export const FIRST_STEPS: Array<{ title: string; body: string }> = [
  { title: 'Pon tu logo y tus datos', body: 'En Mi empresa. Salen en cada recibo.' },
  { title: 'Arma tu lista de precios', body: 'Tus servicios, con lo que cobras por cada uno.' },
  { title: 'Guarda a tus clientes de siempre', body: 'Nombre y teléfono bastan.' },
  { title: 'Haz tu primer ticket', body: 'Cliente, servicios y cómo te pagó.' },
  { title: 'Manda el recibo', body: 'Por WhatsApp, desde el mismo ticket.' },
];

const FirstSteps = () => (
  <section
    aria-labelledby="ayuda-primeros"
    className="zz-edge-y bg-[var(--pt-paper)] px-4 py-[clamp(54px,6vw,86px)] sm:px-[clamp(16px,4vw,40px)]"
  >
    <div className="mx-auto max-w-[1180px]">
      <h2
        id="ayuda-primeros"
        className="m-0 mb-7 font-[family-name:var(--font-marketing-display)] text-[clamp(28px,3.2vw,44px)] leading-[1.02] font-extrabold tracking-[-0.03em]"
      >
        Tus primeros cinco minutos
      </h2>
      <ol className="m-0 flex list-none flex-wrap gap-x-7 gap-y-5 p-0">
        {FIRST_STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex min-w-0 flex-[1_1_180px] flex-col gap-1.5 border-t-2 border-[var(--pt-ink)] pt-3.5"
          >
            <span
              aria-hidden
              className="font-[family-name:var(--font-marketing-mono)] text-sm font-semibold text-[var(--pt-accent)]"
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <strong className="text-lg leading-[1.25] font-semibold">{step.title}</strong>
            <span className="text-[15px] text-[var(--pt-body)]">{step.body}</span>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

/** Dark "¿No encontraste lo que buscabas?" band; absent without a support number. */
export const HelpWhatsAppBand = ({ href }: { href: string }) => (
  <div
    data-testid="ayuda-whatsapp-band"
    className="mx-auto box-border flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-[28px] bg-[var(--pt-ink)] px-[clamp(20px,3vw,36px)] py-7 text-[var(--pt-ground)]"
  >
    <div className="min-w-0 flex-[1_1_280px]">
      <strong className="font-[family-name:var(--font-marketing-display)] text-[26px] leading-tight font-bold tracking-[-0.02em]">
        ¿No encontraste lo que buscabas?
      </strong>
      <p className="mt-1.5 text-[#D9D0C1]">Escríbenos y te ayudamos con tu caso.</p>
    </div>
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="zz-btn inline-flex min-h-14 shrink-0 items-center rounded-[14px] bg-[linear-gradient(135deg,var(--pt-orange-from),var(--pt-button-to))] px-[26px] text-lg font-bold text-[var(--pt-ink)] no-underline hover:text-[var(--pt-ink)]"
    >
      Escribir por WhatsApp
    </a>
  </div>
);

type HelpHomeProps = {
  cards: HelpCard[];
  /** wa.me link built server-side from SUPPORT_WHATSAPP_NUMBER; null hides the band. */
  whatsappHref: string | null;
};

/** /ayuda (ZIG-I40-1). */
export const HelpHome = ({ cards, whatsappHref }: HelpHomeProps) => (
  <HelpShell footerBand={whatsappHref ? <HelpWhatsAppBand href={whatsappHref} /> : null}>
    <HelpGuideSearch cards={cards} hasWhatsApp={Boolean(whatsappHref)} between={<FirstSteps />} />
  </HelpShell>
);
