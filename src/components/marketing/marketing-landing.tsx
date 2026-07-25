import Image from 'next/image';
import Link from 'next/link';
import {
  LANDING_CAPABILITIES,
  LANDING_DEMO,
  LANDING_FINAL_CTA,
  LANDING_FLOW_STEPS,
  LANDING_HERO,
  LANDING_PROBLEM,
} from '@/components/marketing/marketing-landing-content';

const sectionClass =
  'mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 scroll-mt-24';

export const MarketingLanding = () => {
  return (
    <div className="pb-10">
      <section
        className="relative isolate min-h-[min(88svh,52rem)] overflow-hidden border-b border-[var(--mkt-line)]"
        aria-labelledby="landing-hero-heading"
      >
        <div className="absolute inset-0 -z-10">
          <Image
            src={LANDING_HERO.heroImage.src}
            alt={LANDING_HERO.heroImage.alt}
            fill
            sizes="100vw"
            className="marketing-hero-pan object-cover object-[72%_10%]"
            priority
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(90deg,var(--mkt-mist)_0%,var(--mkt-mist)_42%,rgba(231,238,246,0.88)_54%,rgba(231,238,246,0.35)_72%,rgba(231,238,246,0.12)_100%)]"
            aria-hidden
          />
        </div>

        <div className="mx-auto flex min-h-[min(88svh,52rem)] max-w-6xl items-end px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-24">
          <div className="max-w-xl space-y-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700 sm:space-y-6">
            <p className="font-[family-name:var(--font-marketing-display)] text-[clamp(3.5rem,13vw,7.75rem)] font-extrabold leading-[0.88] tracking-[-0.04em] text-[var(--mkt-ink)]">
              {LANDING_HERO.brand}
            </p>
            <svg
              className="marketing-zigzag-stroke h-3 w-40 text-[var(--mkt-signal)] sm:w-56"
              viewBox="0 0 220 12"
              fill="none"
              aria-hidden
            >
              <path
                d="M1 10 L28 2 L55 10 L82 2 L109 10 L136 2 L163 10 L190 2 L219 10"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="square"
                strokeLinejoin="miter"
              />
            </svg>
            <h1
              id="landing-hero-heading"
              className="max-w-xl font-[family-name:var(--font-marketing-display)] text-[clamp(1.7rem,3.8vw,2.55rem)] font-semibold leading-[1.15] tracking-tight text-[var(--mkt-ink)]"
            >
              {LANDING_HERO.headline}
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-[var(--mkt-muted)] sm:text-xl">
              {LANDING_HERO.support}
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href={LANDING_HERO.primaryCta.href}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--mkt-signal)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--mkt-signal-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-signal)] focus-visible:ring-offset-2"
              >
                {LANDING_HERO.primaryCta.label}
              </Link>
              <a
                href={LANDING_HERO.secondaryCta.href}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--mkt-line-strong)] bg-white/80 px-5 text-sm font-semibold text-[var(--mkt-ink)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-signal)] focus-visible:ring-offset-2"
              >
                {LANDING_HERO.secondaryCta.label}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section
        id={LANDING_PROBLEM.id}
        className={`${sectionClass} max-w-3xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700`}
        aria-labelledby="problema-heading"
      >
        <h2
          id="problema-heading"
          className="font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--mkt-ink)] sm:text-4xl"
        >
          {LANDING_PROBLEM.title}
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-[var(--mkt-muted)]">
          {LANDING_PROBLEM.body}
        </p>
      </section>

      <section
        id="como-funciona"
        className={`${sectionClass} space-y-12`}
        aria-labelledby="como-funciona-heading"
      >
        <div className="max-w-3xl space-y-3">
          <h2
            id="como-funciona-heading"
            className="font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--mkt-ink)] sm:text-4xl"
          >
            Cómo funciona
          </h2>
          <p className="text-lg text-[var(--mkt-muted)]">
            Un solo flujo operativo:{' '}
            <span className="font-semibold text-[var(--mkt-ink)]">
              Cliente → Ticket → Servicios → Cobro → Factura PDF
            </span>
            .
          </p>
        </div>
        <ol className="grid gap-14">
          {LANDING_FLOW_STEPS.map((step, index) => (
            <li
              key={step.key}
              className="grid items-center gap-6 md:grid-cols-2 md:gap-12"
            >
              <div className={index % 2 === 1 ? 'md:order-2' : undefined}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mkt-signal)]">
                  Paso {index + 1}
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-marketing-display)] text-2xl font-semibold tracking-tight text-[var(--mkt-ink)] sm:text-3xl">
                  {step.title}
                </h3>
                <p className="mt-3 text-[var(--mkt-muted)] leading-relaxed">
                  {step.body}
                </p>
              </div>
              <div
                className={`overflow-hidden border border-[var(--mkt-line)] bg-white/50 ${
                  index % 2 === 1 ? 'md:order-1' : ''
                }`}
              >
                <Image
                  src={step.image.src}
                  alt={step.image.alt}
                  width={1200}
                  height={750}
                  className="h-auto w-full object-cover"
                  loading="lazy"
                />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="capacidades"
        className={`${sectionClass} space-y-10`}
        aria-labelledby="capacidades-heading"
      >
        <div className="max-w-3xl space-y-3">
          <h2
            id="capacidades-heading"
            className="font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--mkt-ink)] sm:text-4xl"
          >
            Capacidades
          </h2>
          <p className="text-lg text-[var(--mkt-muted)]">
            Lo esencial para operar servicios en LATAM sin fragmentar tu stack.
          </p>
        </div>
        <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_CAPABILITIES.map((capability) => (
            <li
              key={capability.title}
              className="border-t border-[var(--mkt-line-strong)] pt-4"
            >
              <h3 className="font-[family-name:var(--font-marketing-display)] text-lg font-semibold tracking-tight text-[var(--mkt-ink)]">
                {capability.title}
              </h3>
              <p className="mt-2 text-[var(--mkt-muted)] leading-relaxed">
                {capability.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        id={LANDING_DEMO.id}
        className={`${sectionClass} space-y-10`}
        aria-labelledby="demo-heading"
      >
        <div className="max-w-3xl space-y-3">
          <h2
            id="demo-heading"
            className="font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--mkt-ink)] sm:text-4xl"
          >
            {LANDING_DEMO.title}
          </h2>
          <p className="text-lg text-[var(--mkt-muted)]">{LANDING_DEMO.body}</p>
        </div>
        <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_DEMO.stats.map((stat) => (
            <div key={stat.label} className="border-l-2 border-[var(--mkt-signal)] pl-4">
              <dt className="font-[family-name:var(--font-marketing-display)] text-3xl font-bold tracking-tight text-[var(--mkt-ink)]">
                {stat.value}
              </dt>
              <dd className="mt-1 font-semibold text-[var(--mkt-ink)]">
                {stat.label}
              </dd>
              <p className="mt-1 text-sm text-[var(--mkt-muted)]">{stat.detail}</p>
            </div>
          ))}
        </dl>
        <div className="grid gap-4 md:grid-cols-2">
          {LANDING_DEMO.images.map((image) => (
            <div
              key={image.src}
              className="overflow-hidden border border-[var(--mkt-line)] bg-white/40"
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={1200}
                height={750}
                className="h-auto w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </section>

      <section
        className={`${sectionClass}`}
        aria-labelledby="cta-final-heading"
      >
        <div className="relative overflow-hidden bg-[var(--mkt-ink)] px-6 py-12 text-white sm:px-12 sm:py-14">
          <div
            className="pointer-events-none absolute inset-0 marketing-zigzag-grid opacity-[0.12]"
            aria-hidden
          />
          <h2
            id="cta-final-heading"
            className="relative font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            {LANDING_FINAL_CTA.title}
          </h2>
          <p className="relative mt-4 max-w-2xl text-white/80">
            {LANDING_FINAL_CTA.body}
          </p>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link
              href={LANDING_FINAL_CTA.primaryCta.href}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 text-sm font-semibold text-[var(--mkt-ink)] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {LANDING_FINAL_CTA.primaryCta.label}
            </Link>
            <a
              href={LANDING_FINAL_CTA.secondaryCta.href}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/35 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {LANDING_FINAL_CTA.secondaryCta.label}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};
