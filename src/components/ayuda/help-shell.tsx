import Link from 'next/link';
import type { ReactNode } from 'react';
import { ASSISTANT_PAGE_PATH } from '@/components/ayuda/guide-registry';
import { marketingFontVariables } from '@/components/marketing/marketing-fonts';
import { MarketingLogo } from '@/components/marketing/marketing-logo';
import { AYUDA_PATH, PRIVACY_PATH, TERMS_PATH } from '@/lib/marketing-routes';

type HelpShellProps = {
  children: ReactNode;
  /** Shown above the legal line (the /ayuda WhatsApp band). */
  footerBand?: ReactNode;
};

const TOP_LINK =
  'flex min-h-11 items-center px-3 text-[15px] font-semibold text-[var(--pt-ink)] no-underline hover:text-[var(--pt-accent)]';

const LEGAL_LINK =
  'inline-flex min-h-11 items-center text-[var(--pt-muted)] underline-offset-4 hover:text-[var(--pt-accent)] hover:underline';

/**
 * Help centre chrome (ZIG-I40): the "Papel y tinta" surface with an "Ayuda"
 * logo, Guías / Asistentes IA links and Abrir ZigZag. Public, no session.
 */
export const HelpShell = ({ children, footerBand }: HelpShellProps) => (
  <div
    className={`marketing-surface light ${marketingFontVariables} flex min-h-svh flex-col overflow-x-hidden bg-[var(--pt-ground)] font-[family-name:var(--font-marketing-sans)] text-[17px] leading-[1.55] text-[var(--pt-ink)]`}
  >
    <header className="border-b-[1.5px] border-dashed border-[rgba(23,20,15,0.35)] px-4 py-4 sm:px-[clamp(16px,4vw,40px)]">
      <nav
        aria-label="Ayuda"
        className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-3 gap-y-2"
      >
        <Link
          href={AYUDA_PATH}
          aria-label="ZigZag, ayuda"
          className="flex min-h-11 shrink-0 items-center gap-2.5 text-[var(--pt-ink)] no-underline"
        >
          <MarketingLogo />
          <span className="rounded-full border-[1.5px] border-[var(--pt-ink)] px-2.5 py-0.5 font-[family-name:var(--font-marketing-mono)] text-sm font-semibold uppercase tracking-[0.08em]">
            Ayuda
          </span>
        </Link>
        <div className="flex min-w-0 basis-full flex-wrap items-center gap-x-1 gap-y-2 sm:basis-auto sm:flex-1 sm:justify-end">
          <Link href={AYUDA_PATH} className={`${TOP_LINK} -ml-3 sm:ml-0`}>
            Guías
          </Link>
          <Link href={ASSISTANT_PAGE_PATH} className={TOP_LINK}>
            Asistentes IA
          </Link>
          <Link
            href="/login"
            className="zz-btn ml-auto flex h-11 shrink-0 items-center whitespace-nowrap rounded-xl bg-[var(--pt-ink)] px-[18px] text-[15px] font-semibold text-[var(--pt-ground)] no-underline hover:text-[var(--pt-ground)]"
          >
            Abrir ZigZag
          </Link>
        </div>
      </nav>
    </header>

    <main id="inicio" className="flex flex-col">
      {children}
    </main>

    <footer className="flex flex-[1_0_auto] flex-col px-4 pt-6 pb-8 sm:px-[clamp(16px,4vw,40px)]">
      {footerBand}
      <p className="mx-auto mt-4 flex w-full max-w-[1180px] flex-wrap items-center gap-x-2 text-sm text-[var(--pt-muted)]">
        <span>© {new Date().getFullYear()} ZigZag</span>
        <span aria-hidden>·</span>
        <Link href={PRIVACY_PATH} className={LEGAL_LINK}>
          Aviso de privacidad
        </Link>
        <span aria-hidden>·</span>
        <Link href={TERMS_PATH} className={LEGAL_LINK}>
          Términos y condiciones
        </Link>
      </p>
    </footer>
  </div>
);
