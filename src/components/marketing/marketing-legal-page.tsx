import type { ReactNode } from 'react';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/marketing-shell';

type MarketingLegalPageProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export const MarketingLegalPage = ({
  title,
  description,
  children,
}: MarketingLegalPageProps) => {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm font-medium text-primary">
          <Link href="/" className="hover:underline">
            ZigZag
          </Link>
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-muted-foreground">{description}</p>
        <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground">
          {children ?? (
            <p className="text-muted-foreground">
              Contenido legal completo pendiente. Esta ruta pública ya está
              disponible para enlaces de marketing y SEO.
            </p>
          )}
        </div>
      </article>
    </MarketingShell>
  );
};
