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
  'mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 scroll-mt-24';

const fadeInClass =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700';

export const MarketingLanding = () => {
  return (
    <div className="pb-8">
      <section
        className={`${sectionClass} grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] ${fadeInClass}`}
        aria-labelledby="landing-hero-heading"
      >
        <div className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            {LANDING_HERO.brand}
          </p>
          <h1
            id="landing-hero-heading"
            className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]"
          >
            {LANDING_HERO.headline}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {LANDING_HERO.support}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={LANDING_HERO.primaryCta.href}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {LANDING_HERO.primaryCta.label}
            </Link>
            <a
              href={LANDING_HERO.secondaryCta.href}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background/80 px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {LANDING_HERO.secondaryCta.label}
            </a>
          </div>
        </div>
        <div className="relative -mx-4 overflow-hidden border-y border-border/70 bg-card shadow-[0_28px_80px_-36px_rgba(37,99,235,0.55)] sm:mx-0 sm:rounded-2xl sm:border">
          <Image
            src={LANDING_HERO.heroImage.src}
            alt={LANDING_HERO.heroImage.alt}
            width={1400}
            height={900}
            className="h-auto w-full object-cover"
            priority
          />
        </div>
      </section>

      <section
        id={LANDING_PROBLEM.id}
        className={`${sectionClass} max-w-3xl ${fadeInClass}`}
        aria-labelledby="problema-heading"
      >
        <h2
          id="problema-heading"
          className="text-3xl font-semibold tracking-tight"
        >
          {LANDING_PROBLEM.title}
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">{LANDING_PROBLEM.body}</p>
      </section>

      <section
        id="como-funciona"
        className={`${sectionClass} space-y-10 ${fadeInClass}`}
        aria-labelledby="como-funciona-heading"
      >
        <div className="max-w-3xl space-y-3">
          <h2
            id="como-funciona-heading"
            className="text-3xl font-semibold tracking-tight"
          >
            Cómo funciona
          </h2>
          <p className="text-lg text-muted-foreground">
            Un solo flujo operativo:{' '}
            <span className="font-medium text-foreground">
              Cliente → Ticket → Servicios → Cobro → Factura PDF
            </span>
            .
          </p>
        </div>
        <ol className="grid gap-8">
          {LANDING_FLOW_STEPS.map((step, index) => (
            <li
              key={step.key}
              className="grid items-center gap-6 md:grid-cols-2 md:gap-10"
            >
              <div className={index % 2 === 1 ? 'md:order-2' : undefined}>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                  Paso {index + 1}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-3 text-muted-foreground">{step.body}</p>
              </div>
              <div
                className={`overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm ${
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
        className={`${sectionClass} space-y-8 ${fadeInClass}`}
        aria-labelledby="capacidades-heading"
      >
        <div className="max-w-3xl space-y-3">
          <h2
            id="capacidades-heading"
            className="text-3xl font-semibold tracking-tight"
          >
            Capacidades
          </h2>
          <p className="text-lg text-muted-foreground">
            Lo esencial para operar servicios en LATAM sin fragmentar tu stack.
          </p>
        </div>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_CAPABILITIES.map((capability) => (
            <li key={capability.title} className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">
                {capability.title}
              </h3>
              <p className="text-muted-foreground">{capability.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        id={LANDING_DEMO.id}
        className={`${sectionClass} space-y-8 ${fadeInClass}`}
        aria-labelledby="demo-heading"
      >
        <div className="max-w-3xl space-y-3">
          <h2 id="demo-heading" className="text-3xl font-semibold tracking-tight">
            {LANDING_DEMO.title}
          </h2>
          <p className="text-lg text-muted-foreground">{LANDING_DEMO.body}</p>
        </div>
        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_DEMO.stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-3xl font-semibold tracking-tight text-primary">
                {stat.value}
              </dt>
              <dd className="mt-1 font-medium text-foreground">{stat.label}</dd>
              <p className="mt-1 text-sm text-muted-foreground">{stat.detail}</p>
            </div>
          ))}
        </dl>
        <div className="grid gap-4 md:grid-cols-2">
          {LANDING_DEMO.images.map((image) => (
            <div
              key={image.src}
              className="overflow-hidden rounded-xl border border-border/70 bg-card"
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
        className={`${sectionClass} ${fadeInClass}`}
        aria-labelledby="cta-final-heading"
      >
        <div className="rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:px-10">
          <h2
            id="cta-final-heading"
            className="text-3xl font-semibold tracking-tight"
          >
            {LANDING_FINAL_CTA.title}
          </h2>
          <p className="mt-3 max-w-2xl text-primary-foreground/90">
            {LANDING_FINAL_CTA.body}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={LANDING_FINAL_CTA.primaryCta.href}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-background/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {LANDING_FINAL_CTA.primaryCta.label}
            </Link>
            <a
              href={LANDING_FINAL_CTA.secondaryCta.href}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary-foreground/40 px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {LANDING_FINAL_CTA.secondaryCta.label}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};
