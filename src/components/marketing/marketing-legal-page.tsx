import type { ReactNode } from 'react';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import {
  LEGAL_DISCLAIMER,
  LEGAL_PLACEHOLDERS,
  type LegalSection,
  resolveLegalText,
} from '@/components/marketing/marketing-legal-content';

type MarketingLegalPageProps = {
  title: string;
  description: string;
  sections: LegalSection[];
  children?: ReactNode;
};

export const MarketingLegalPage = ({
  title,
  description,
  sections,
  children,
}: MarketingLegalPageProps) => {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="font-[family-name:var(--font-marketing-mono)] text-sm font-medium tracking-[0.08em] uppercase text-[var(--pt-accent)]">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            ZigZag
          </Link>
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-marketing-display)] text-3xl font-extrabold tracking-[-0.03em] text-[var(--pt-ink)] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-[var(--pt-body)]">{description}</p>
        <p
          className="mt-4 rounded-md border border-[var(--pt-line-strong)] bg-[var(--pt-paper)] px-3 py-2 text-sm text-[var(--pt-ink)]"
          role="note"
        >
          {LEGAL_DISCLAIMER}
        </p>
        <dl className="mt-6 grid gap-2 text-sm text-[var(--pt-body)] sm:grid-cols-2">
          <div>
            <dt className="font-medium text-[var(--pt-ink)]">Responsable</dt>
            <dd data-testid="legal-placeholder-responsable">
              {LEGAL_PLACEHOLDERS.responsable}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--pt-ink)]">Domicilio</dt>
            <dd data-testid="legal-placeholder-domicilio">
              {LEGAL_PLACEHOLDERS.domicilio}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--pt-ink)]">Email de privacidad</dt>
            <dd data-testid="legal-placeholder-email">
              {LEGAL_PLACEHOLDERS.email}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--pt-ink)]">Vigencia</dt>
            <dd data-testid="legal-placeholder-vigencia">
              {LEGAL_PLACEHOLDERS.vigencia}
            </dd>
          </div>
        </dl>

        <div className="mt-10 space-y-8 text-base leading-relaxed">
          {sections.map((section) => (
            <section key={section.title} aria-labelledby={section.title}>
              <h2
                id={section.title}
                className="font-[family-name:var(--font-marketing-display)] text-xl font-extrabold tracking-[-0.03em] text-[var(--pt-ink)]"
              >
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-[var(--pt-body)]">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>
                    {resolveLegalText(paragraph)}
                  </p>
                ))}
              </div>
            </section>
          ))}
          {children}
        </div>
      </article>
    </MarketingShell>
  );
};
