import Link from 'next/link';
import type { ReactNode } from 'react';
import { LANDING_NAV_LINKS } from '@/components/marketing/marketing-landing-content';
import { marketingFontVariables } from '@/components/marketing/marketing-fonts';
import { MarketingLogo } from '@/components/marketing/marketing-logo';
import {
  AYUDA_PATH,
  MCP_DOCS_PATH,
  PRIVACY_PATH,
  TERMS_PATH,
} from '@/lib/marketing-routes';

type MarketingShellProps = {
  children: ReactNode;
  /** Landing only: show the in-page section links and keep anchors on this page. */
  showSectionNav?: boolean;
};

/** Breakpoint at which each section link has room in the top bar. */
const SECTION_LINK_DISPLAY = {
  md: 'hidden md:flex',
  lg: 'hidden lg:flex',
} as const;

const FOOTER_LINK =
  'flex min-h-11 items-center px-2.5 text-[var(--pt-ink)] underline-offset-4 hover:text-[var(--pt-accent)] hover:underline';

/**
 * Public marketing chrome ("Papel y tinta"): paper ground, ink type, no app
 * shell. Locked to light so system dark mode does not change the brand.
 */
export const MarketingShell = ({
  children,
  showSectionNav = false,
}: MarketingShellProps) => {
  const accessHref = showSectionNav ? '#acceso' : '/#acceso';

  return (
    <div
      className={`marketing-surface light ${marketingFontVariables} flex min-h-svh flex-col overflow-x-hidden bg-[var(--pt-ground)] font-[family-name:var(--font-marketing-sans)] text-[17px] leading-[1.55] text-[var(--pt-ink)]`}
    >
      <header className="px-4 py-4 sm:px-[clamp(16px,4vw,40px)]">
        <nav
          aria-label="Principal"
          className="mx-auto flex max-w-[1180px] items-center gap-2 sm:gap-3"
        >
          <MarketingLogo href="/" />
          {showSectionNav ? (
            <div
              className="hidden h-11 min-w-0 flex-1 flex-wrap content-start justify-center gap-x-1 overflow-hidden md:flex"
              data-testid="marketing-section-nav"
            >
              {LANDING_NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`${SECTION_LINK_DISPLAY[link.minWidth]} h-11 items-center whitespace-nowrap px-3.5 text-[15px] font-medium text-[var(--pt-body)] no-underline hover:text-[var(--pt-accent)]`}
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
          <Link
            href="/login"
            className={`${showSectionNav ? 'ml-auto md:ml-0' : 'ml-auto'} flex h-11 shrink-0 items-center whitespace-nowrap px-2.5 text-[15px] font-semibold text-[var(--pt-ink)] no-underline hover:text-[var(--pt-accent)] sm:px-3`}
          >
            Entrar
          </Link>
          <a
            href={accessHref}
            className="zz-btn flex h-11 shrink-0 items-center whitespace-nowrap rounded-xl bg-[var(--pt-ink)] px-3.5 text-[15px] font-semibold text-[var(--pt-ground)] no-underline hover:text-[var(--pt-ground)] sm:px-[18px]"
          >
            Pedir acceso
          </a>
        </nav>
      </header>

      <main id="inicio" className="flex flex-col">
        {children}
      </main>

      <footer className="flex flex-[1_0_auto] flex-col justify-between gap-10 px-4 pt-[clamp(40px,5vw,64px)] pb-7 sm:px-[clamp(16px,4vw,40px)]">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-start justify-between gap-x-12 gap-y-6">
          <div className="flex flex-col gap-2.5">
            <MarketingLogo size="sm" />
            <p className="text-[15px] text-[var(--pt-muted)]">
              Del ticket al cobro, en un solo flujo.
            </p>
          </div>
          <nav aria-label="Pie de página">
            <ul className="flex flex-wrap gap-x-2 gap-y-1 text-[15px]">
              <li>
                <Link href={AYUDA_PATH} className={FOOTER_LINK}>
                  Guías
                </Link>
              </li>
              <li>
                <Link href={MCP_DOCS_PATH} className={FOOTER_LINK}>
                  Conector para asistentes IA
                </Link>
              </li>
              <li>
                <Link href={PRIVACY_PATH} className={FOOTER_LINK}>
                  Aviso de privacidad
                </Link>
              </li>
              <li>
                <Link href={TERMS_PATH} className={FOOTER_LINK}>
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link href="/login" className={FOOTER_LINK}>
                  Entrar
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div
          aria-hidden
          className="mx-auto w-full max-w-[1180px] select-none font-[family-name:var(--font-marketing-display)] text-[clamp(88px,23vw,340px)] leading-[0.8] font-extrabold tracking-[-0.06em] text-[var(--pt-pale)]"
        >
          ZigZag
        </div>
        <p className="mx-auto w-full max-w-[1180px] text-sm text-[var(--pt-muted)]">
          © {new Date().getFullYear()} ZigZag
        </p>
      </footer>
    </div>
  );
};
