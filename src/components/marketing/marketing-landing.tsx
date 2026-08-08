'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  LANDING_CAPABILITIES,
  LANDING_DEMO,
  LANDING_FINAL_CTA,
  LANDING_FLOW_MARQUEE,
  LANDING_FLOW_STEPS,
  LANDING_HERO,
  LANDING_PROBLEM,
} from '@/components/marketing/marketing-landing-content';

const sectionClass =
  'mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 scroll-mt-24';

const easeOut = [0.22, 1, 0.36, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easeOut },
  },
};

const stagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const Reveal = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.25 }}
    >
      {children}
    </motion.div>
  );
};

/** Whole-word reveal so the brand never wraps mid-name like per-letter spans can. */
const BrandMark = () => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.p
      className="marketing-brand"
      initial={
        reduceMotion
          ? false
          : { clipPath: 'inset(0 100% 0 0)', opacity: 0.35 }
      }
      animate={{ clipPath: 'inset(0 0% 0 0)', opacity: 1 }}
      transition={{ duration: 0.9, delay: 0.12, ease: easeOut }}
    >
      {LANDING_HERO.brand}
    </motion.p>
  );
};

/** Signature brand stroke that rides under the wordmark. */
const ZigZagStroke = () => {
  const reduceMotion = useReducedMotion();

  return (
    <svg
      className="h-3 w-40 text-[var(--mkt-signal)] sm:h-3.5 sm:w-64"
      viewBox="0 0 240 14"
      fill="none"
      aria-hidden
    >
      <motion.path
        d="M2 11 L32 3 L62 11 L92 3 L122 11 L152 3 L182 11 L212 3 L238 11"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
        strokeLinejoin="miter"
        initial={reduceMotion ? false : { pathLength: 0, opacity: 0.25 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.1, delay: 0.55, ease: easeOut }}
      />
    </svg>
  );
};

/**
 * Large structural zigzag that cuts the hero: the brand gesture.
 * Desktop: vertical cut between copy mist and product.
 * Mobile: horizontal cut between product top and copy bottom.
 */
const HeroZigZagCut = () => {
  const reduceMotion = useReducedMotion();

  return (
    <>
      {/* Desktop vertical cut edge past the brand column */}
      <svg
        className="pointer-events-none absolute inset-y-0 left-[58%] z-[1] hidden h-full w-[14%] text-[var(--mkt-signal)] md:block"
        viewBox="0 0 80 1000"
        preserveAspectRatio="none"
        aria-hidden
      >
        <motion.path
          d="M40 0 L12 70 L52 140 L12 210 L52 280 L12 350 L52 420 L12 490 L52 560 L12 630 L52 700 L12 770 L52 840 L12 910 L40 1000"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.85 }}
          transition={{ duration: 1.4, delay: 0.35, ease: easeOut }}
        />
      </svg>

      {/* Mobile horizontal cut edge at mist transition, above copy */}
      <svg
        className="pointer-events-none absolute inset-x-0 top-[40%] z-[1] h-8 w-full text-[var(--mkt-signal)] md:hidden"
        viewBox="0 0 400 32"
        preserveAspectRatio="none"
        aria-hidden
      >
        <motion.path
          d="M0 20 L28 6 L56 20 L84 6 L112 20 L140 6 L168 20 L196 6 L224 20 L252 6 L280 20 L308 6 L336 20 L364 6 L400 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.9 }}
          transition={{ duration: 1.15, delay: 0.3, ease: easeOut }}
        />
      </svg>
    </>
  );
};

const FlowMarquee = () => {
  const items = [...LANDING_FLOW_MARQUEE, ...LANDING_FLOW_MARQUEE];

  return (
    <div
      className="relative overflow-hidden border-y border-[var(--mkt-line)] bg-[var(--mkt-foam)]/70 py-4"
      aria-hidden
    >
      <div className="marketing-marquee-track px-4">
        {items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="flex items-center gap-10 font-[family-name:var(--font-marketing-display)] text-sm font-semibold uppercase tracking-[0.22em] text-[var(--mkt-ink)]/70"
          >
            {item}
            <span className="text-[var(--mkt-signal)]">→</span>
          </span>
        ))}
      </div>
    </div>
  );
};

const AnimatedStat = ({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduceMotion = useReducedMotion();
  const numeric = Number(value.replace(/[^\d]/g, ''));
  const isNumeric =
    Number.isFinite(numeric) && /^\d+$/.test(value.replace('+', ''));
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!inView || reduceMotion || !isNumeric) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const frames = 36;
    const tick = () => {
      frame += 1;
      const progress = Math.min(1, frame / frames);
      const eased = 1 - (1 - progress) ** 3;
      const current = Math.round(numeric * eased);
      setDisplay(value.includes('+') ? `${current}+` : String(current));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [inView, isNumeric, numeric, reduceMotion, value]);

  return (
    <div ref={ref} className="border-l-2 border-[var(--mkt-signal)] pl-4">
      <dt className="font-[family-name:var(--font-marketing-display)] text-3xl font-bold tracking-tight text-[var(--mkt-ink)] sm:text-4xl">
        {value.startsWith('$') ? value : display}
      </dt>
      <dd className="mt-1 font-semibold text-[var(--mkt-ink)]">{label}</dd>
      <p className="mt-1 text-sm text-[var(--mkt-muted)]">{detail}</p>
    </div>
  );
};

const FLOW_FEATURED = LANDING_FLOW_STEPS.slice(0, 2);
const FLOW_GRID = LANDING_FLOW_STEPS.slice(2);

/** Tint accents for capability cells so the grid is not cream-on-cream text only. */
const CAPABILITY_SURFACES = [
  'bg-[var(--mkt-foam)]/90 border-[var(--mkt-line)]',
  'bg-white/70 border-[var(--mkt-line)]',
  'bg-[color-mix(in_srgb,var(--mkt-signal)_8%,white)] border-[color-mix(in_srgb,var(--mkt-signal)_22%,transparent)]',
  'bg-white/70 border-[var(--mkt-line)]',
  'bg-[color-mix(in_srgb,var(--mkt-teal)_10%,white)] border-[color-mix(in_srgb,var(--mkt-teal)_24%,transparent)]',
  'bg-[var(--mkt-foam)]/90 border-[var(--mkt-line)]',
] as const;

export const MarketingLanding = () => {
  const reduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '10%']);
  const imageScale = useSpring(
    useTransform(scrollYProgress, [0, 1], [1.06, 1.14]),
    { stiffness: 55, damping: 24 },
  );

  return (
    <div className="pb-12">
      <section
        ref={heroRef}
        className="marketing-hero relative isolate overflow-hidden"
        aria-labelledby="landing-hero-heading"
      >
        {/* Full-bleed product plane: one composition on every breakpoint */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <motion.div
            className="absolute inset-0"
            style={
              reduceMotion
                ? undefined
                : {
                    y: imageY,
                    scale: imageScale,
                  }
            }
          >
            <picture>
              <source
                media="(min-width: 768px)"
                srcSet={LANDING_HERO.heroImage.desktopSrc}
                type="image/webp"
              />
              {/* Native img avoids next/image fill hydration races in the hero. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={LANDING_HERO.heroImage.mobileSrc}
                alt={LANDING_HERO.heroImage.alt}
                className="absolute inset-0 h-full w-full object-cover object-[center_18%] md:object-[center_12%]"
                decoding="async"
                fetchPriority="high"
              />
            </picture>
          </motion.div>

          {/* Mobile: product stays visible up top; mist locks under the cut */}
          <div
            className="marketing-hero-scrim-mobile absolute inset-0 md:hidden"
            aria-hidden
          />

          {/* Desktop: zigzag-edged mist panel for the crop reveal */}
          <div
            className="marketing-hero-cut absolute inset-0 hidden bg-[var(--mkt-mist)] md:block"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 hidden marketing-mesh opacity-50 mix-blend-multiply md:block"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 hidden marketing-grain opacity-70 md:block"
            aria-hidden
          />
        </div>

        <HeroZigZagCut />

        <div className="marketing-hero-copy relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <div className="marketing-hero-copy-stack">
            <BrandMark />
            <ZigZagStroke />
            <motion.h1
              id="landing-hero-heading"
              className="marketing-display max-w-xl text-[1.55rem] font-semibold leading-[1.15] tracking-tight text-[var(--mkt-ink)] sm:text-[2rem] md:text-[2.55rem]"
              initial={
                reduceMotion ? false : { opacity: 0, y: 22 }
              }
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.5, ease: easeOut }}
            >
              {LANDING_HERO.headline}
            </motion.h1>
            <motion.p
              className="max-w-[36ch] text-base leading-relaxed text-[var(--mkt-muted)] sm:max-w-lg sm:text-lg md:text-xl"
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.65, ease: easeOut }}
            >
              {LANDING_HERO.support}
            </motion.p>
            <motion.div
              className="flex flex-wrap gap-3 pt-0.5"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8, ease: easeOut }}
            >
              <Link
                href={LANDING_HERO.primaryCta.href}
                className="marketing-cta-shine inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--mkt-signal)] px-5 text-sm font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.98] hover:bg-[var(--mkt-signal-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-signal)] focus-visible:ring-offset-2"
              >
                {LANDING_HERO.primaryCta.label}
              </Link>
              <a
                href={LANDING_HERO.secondaryCta.href}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--mkt-line-strong)] bg-[var(--mkt-foam)]/90 px-5 text-sm font-semibold text-[var(--mkt-ink)] transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.98] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-signal)] focus-visible:ring-offset-2"
              >
                {LANDING_HERO.secondaryCta.label}
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      <Reveal>
        <section
          id={LANDING_PROBLEM.id}
          className={`${sectionClass} max-w-3xl`}
          aria-labelledby="problema-heading"
        >
          <h2
            id="problema-heading"
            className="font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--mkt-ink)] sm:text-5xl"
          >
            {LANDING_PROBLEM.title}
          </h2>
          <p className="mt-6 max-w-[65ch] text-lg leading-relaxed text-[var(--mkt-muted)] sm:text-xl">
            {LANDING_PROBLEM.body}
          </p>
        </section>
      </Reveal>

      <FlowMarquee />

      <section
        id="como-funciona"
        className={`${sectionClass} space-y-16`}
        aria-labelledby="como-funciona-heading"
      >
        <Reveal className="max-w-3xl space-y-4">
          <h2
            id="como-funciona-heading"
            className="font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--mkt-ink)] sm:text-5xl"
          >
            Cómo funciona
          </h2>
          <p className="max-w-[65ch] text-lg text-[var(--mkt-muted)] sm:text-xl">
            Un solo flujo operativo:{' '}
            <span className="font-semibold text-[var(--mkt-ink)]">
              Cliente → Ticket → Servicios → Cobro → Recibo PDF
            </span>
            .
          </p>
        </Reveal>

        {/* Max 2 zigzag image/text splits, then a different layout family */}
        <ol className="grid gap-16">
          {FLOW_FEATURED.map((step, index) => (
            <motion.li
              key={step.key}
              className="grid items-center gap-6 md:grid-cols-2 md:gap-14"
              initial={reduceMotion ? false : { opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease: easeOut }}
            >
              <div className={index % 2 === 1 ? 'md:order-2' : undefined}>
                <h3 className="font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--mkt-ink)]">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-md text-[var(--mkt-muted)] leading-relaxed">
                  {step.body}
                </p>
              </div>
              <div
                className={`group relative overflow-hidden rounded-md border border-[var(--mkt-line)] bg-white/60 ${
                  index % 2 === 1 ? 'md:order-1' : ''
                }`}
              >
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-1 bg-[var(--mkt-signal)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  aria-hidden
                />
                <Image
                  src={step.image.src}
                  alt={step.image.alt}
                  width={1200}
                  height={750}
                  className="h-auto w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>
            </motion.li>
          ))}
        </ol>

        <motion.ul
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          variants={reduceMotion ? undefined : stagger}
          initial={reduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {FLOW_GRID.map((step) => (
            <motion.li
              key={step.key}
              className="overflow-hidden rounded-md border border-[var(--mkt-line)] bg-white/70"
              variants={fadeUp}
            >
              <Image
                src={step.image.src}
                alt={step.image.alt}
                width={1200}
                height={750}
                className="h-auto w-full object-cover"
                loading="lazy"
              />
              <div className="space-y-2 border-t border-[var(--mkt-line)] px-4 py-4">
                <h3 className="font-[family-name:var(--font-marketing-display)] text-xl font-semibold tracking-tight text-[var(--mkt-ink)]">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--mkt-muted)]">
                  {step.body}
                </p>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </section>

      <section
        id="capacidades"
        className={`${sectionClass} space-y-12`}
        aria-labelledby="capacidades-heading"
      >
        <Reveal className="max-w-3xl space-y-4">
          <h2
            id="capacidades-heading"
            className="font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--mkt-ink)] sm:text-5xl"
          >
            Capacidades
          </h2>
          <p className="max-w-[65ch] text-lg text-[var(--mkt-muted)] sm:text-xl">
            Lo esencial para operar servicios en LATAM sin fragmentar tu
            operación.
          </p>
        </Reveal>
        <motion.ul
          className="grid gap-4 md:grid-cols-6"
          variants={reduceMotion ? undefined : stagger}
          initial={reduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {LANDING_CAPABILITIES.map((capability, index) => {
            const spanClass =
              index === 0
                ? 'md:col-span-3'
                : index === 1
                  ? 'md:col-span-3'
                  : 'md:col-span-2';

            return (
              <motion.li
                key={capability.title}
                className={`rounded-md border p-5 transition-colors hover:border-[var(--mkt-signal)] ${CAPABILITY_SURFACES[index]} ${spanClass}`}
                variants={fadeUp}
              >
                <h3 className="font-[family-name:var(--font-marketing-display)] text-lg font-semibold tracking-tight text-[var(--mkt-ink)]">
                  {capability.title}
                </h3>
                <p className="mt-2 text-[var(--mkt-muted)] leading-relaxed">
                  {capability.body}
                </p>
              </motion.li>
            );
          })}
        </motion.ul>
      </section>

      <section
        id={LANDING_DEMO.id}
        className={`${sectionClass} space-y-12`}
        aria-labelledby="demo-heading"
      >
        <Reveal className="max-w-3xl space-y-4">
          <h2
            id="demo-heading"
            className="font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--mkt-ink)] sm:text-5xl"
          >
            {LANDING_DEMO.title}
          </h2>
          <p className="max-w-[65ch] text-lg text-[var(--mkt-muted)] sm:text-xl">
            {LANDING_DEMO.body}
          </p>
        </Reveal>
        <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_DEMO.stats.map((stat) => (
            <AnimatedStat
              key={stat.label}
              value={stat.value}
              label={stat.label}
              detail={stat.detail}
            />
          ))}
        </dl>
        <div className="grid gap-5 md:grid-cols-2">
          {LANDING_DEMO.images.map((image, index) => (
            <motion.div
              key={image.src}
              className="overflow-hidden rounded-md border border-[var(--mkt-line)] bg-white/50"
              initial={reduceMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.65,
                delay: index * 0.08,
                ease: easeOut,
              }}
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={1200}
                height={750}
                className="h-auto w-full object-cover"
                loading="lazy"
              />
            </motion.div>
          ))}
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="cta-final-heading">
        <motion.div
          className="relative overflow-hidden rounded-md bg-[var(--mkt-ink)] px-6 py-14 text-white sm:px-12 sm:py-16"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          <div
            className="pointer-events-none absolute inset-0 marketing-zigzag-grid opacity-[0.14]"
            aria-hidden
          />
          <svg
            className="pointer-events-none absolute -right-4 top-6 h-24 w-40 text-[var(--mkt-signal)] opacity-70 sm:h-28 sm:w-52"
            viewBox="0 0 220 60"
            fill="none"
            aria-hidden
          >
            <path
              d="M4 48 L34 12 L64 48 L94 12 L124 48 L154 12 L184 48 L214 12"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          </svg>
          <h2
            id="cta-final-heading"
            className="relative font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight sm:text-5xl"
          >
            {LANDING_FINAL_CTA.title}
          </h2>
          <p className="relative mt-4 max-w-2xl text-base text-white/80 sm:text-lg">
            {LANDING_FINAL_CTA.body}
          </p>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link
              href={LANDING_FINAL_CTA.primaryCta.href}
              className="marketing-cta-shine inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 text-sm font-semibold text-[var(--mkt-ink)] transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.98] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {LANDING_FINAL_CTA.primaryCta.label}
            </Link>
            <a
              href={LANDING_FINAL_CTA.secondaryCta.href}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/35 px-5 text-sm font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.98] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {LANDING_FINAL_CTA.secondaryCta.label}
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  );
};
