import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { LANDING_NAV_LINKS } from '@/components/marketing/marketing-landing-content';
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
 */
export const MarketingShell = ({
  children,
  showSectionNav = false,
}: MarketingShellProps) => {
  return (
    <div className="relative min-h-svh overflow-x-hidden bg-[radial-gradient(ellipse_at_top,_#eff6ff_0%,_#ffffff_45%,_#f8fafc_100%)] text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md motion-safe:transition-[box-shadow] motion-safe:duration-300">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
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
            <span className="text-lg">ZigZag</span>
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
                    className="hidden rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
                  >
                    {link.label}
                  </a>
                ))
              : null}
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Iniciar sesión
            </Link>
            {showSectionNav ? (
              <a
                href="#como-funciona"
                className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Ver cómo funciona
              </a>
            ) : null}
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-8 border-t border-border/60 bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} ZigZag</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            <li>
              <Link
                href={PRIVACY_PATH}
                className="underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Aviso de privacidad
              </Link>
            </li>
            <li>
              <Link
                href={TERMS_PATH}
                className="underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Términos y condiciones
              </Link>
            </li>
            <li>
              <Link
                href="/guides"
                className="underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
