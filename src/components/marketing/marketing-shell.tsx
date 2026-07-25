import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { LANDING_NAV_LINKS } from '@/components/marketing/marketing-landing-content';
import {
  marketingDisplay,
  marketingSans,
} from '@/components/marketing/marketing-fonts';
import {
  PRIVACY_PATH,
  TERMS_PATH,
} from '@/lib/marketing-routes';

type MarketingShellProps = {
  children: ReactNode;
  showSectionNav?: boolean;
};

/**
 * Public marketing chrome — no dashboard sidebar / app shell.
 * Locked to a light branded surface so system dark mode does not dilute the landing.
 */
export const MarketingShell = ({
  children,
  showSectionNav = false,
}: MarketingShellProps) => {
  return (
    <div
      className={`marketing-surface light ${marketingDisplay.variable} ${marketingSans.variable} relative min-h-svh overflow-x-hidden text-[var(--mkt-ink)]`}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[var(--mkt-mist)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 marketing-zigzag-grid opacity-[0.45]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(ellipse_at_20%_0%,rgba(29,111,232,0.18),transparent_55%),radial-gradient(ellipse_at_90%_10%,rgba(15,118,110,0.12),transparent_50%)]"
        aria-hidden
      />

      <header className="sticky top-0 z-40 border-b border-[var(--mkt-line)] bg-[color-mix(in_srgb,var(--mkt-mist)_82%,white)] backdrop-blur-md motion-safe:transition-[box-shadow] motion-safe:duration-300">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-signal)]"
            aria-label="ZigZag inicio"
          >
            <Image
              src="/logo.png"
              alt=""
              width={36}
              height={36}
              className="rounded-md"
              priority
            />
            <span className="font-[family-name:var(--font-marketing-display)] text-xl font-bold">
              ZigZag
            </span>
          </Link>
          <nav
            className="flex flex-wrap items-center justify-end gap-1 sm:gap-2"
            aria-label="Navegación de marketing"
          >
            {showSectionNav
              ? LANDING_NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="hidden rounded-md px-2.5 py-2 text-sm font-medium text-[var(--mkt-muted)] transition-colors hover:text-[var(--mkt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-signal)] md:inline-flex"
                  >
                    {link.label}
                  </a>
                ))
              : null}
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-[var(--mkt-muted)] transition-colors hover:text-[var(--mkt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-signal)]"
            >
              Iniciar sesión
            </Link>
            {showSectionNav ? (
              <a
                href="#como-funciona"
                className="inline-flex min-h-10 items-center rounded-md bg-[var(--mkt-signal)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--mkt-signal-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-signal)]"
              >
                Ver cómo funciona
              </a>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="font-[family-name:var(--font-marketing-sans)]">
        {children}
      </main>

      <footer className="mt-8 border-t border-[var(--mkt-line)] bg-[color-mix(in_srgb,var(--mkt-mist)_70%,white)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-[var(--mkt-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="font-[family-name:var(--font-marketing-display)] font-semibold text-[var(--mkt-ink)]">
            © {new Date().getFullYear()} ZigZag
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            <li>
              <Link
                href={PRIVACY_PATH}
                className="underline-offset-4 hover:text-[var(--mkt-ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-signal)]"
              >
                Aviso de privacidad
              </Link>
            </li>
            <li>
              <Link
                href={TERMS_PATH}
                className="underline-offset-4 hover:text-[var(--mkt-ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-signal)]"
              >
                Términos y condiciones
              </Link>
            </li>
            <li>
              <Link
                href="/guides"
                className="underline-offset-4 hover:text-[var(--mkt-ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-signal)]"
              >
                Guías de producto
              </Link>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
};
