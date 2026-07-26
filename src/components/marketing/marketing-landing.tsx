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
  'mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 scroll-mt-24';

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

const BrandMark = () => {
  const reduceMotion = useReducedMotion();
  const letters = LANDING_HERO.brand.split('');

  if (reduceMotion) {
    return (
      <p className="whitespace-nowrap font-[family-name:var(--font-marketing-display)] text-[clamp(3.25rem,12vw,8rem)] font-extrabold leading-[0.86] tracking-[-0.045em] text-[var(--mkt-ink)]">
        {LANDING_HERO.brand}
      </p>
    );
  }

  return (
    <p
      className="flex flex-nowrap whitespace-nowrap font-[family-name:var(--font-marketing-display)] text-[clamp(3.25rem,12vw,8rem)] font-extrabold leading-[0.86] tracking-[-0.045em] text-[var(--mkt-ink)]"
      aria-label={LANDING_HERO.brand}
    >
      {letters.map((letter, index) => (
        <motion.span
          key={`${letter}-${index}`}
          className="inline-block"
          initial={{ opacity: 0, y: 36, rotate: -4 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{
            duration: 0.65,
            delay: 0.08 + index * 0.05,
            ease: easeOut,
          }}
        >
          {letter}
        </motion.span>
      ))}
    </p>
  );
};

const ZigZagStroke = () => {
  const reduceMotion = useReducedMotion();

  return (
    <svg
      className="h-3 w-44 text-[var(--mkt-signal)] sm:w-60"
      viewBox="0 0 220 12"
      fill="none"
      aria-hidden
    >
      <motion.path
        d="M1 10 L28 2 L55 10 L82 2 L109 10 L136 2 L163 10 L190 2 L219 10"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="square"
        strokeLinejoin="miter"
        initial={reduceMotion ? false : { pathLength: 0, opacity: 0.3 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.05, delay: 0.45, ease: easeOut }}
      />
    </svg>
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
  const isNumeric = Number.isFinite(numeric) && /^\d+$/.test(value.replace('+', ''));
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
      setDisplay(
        value.includes('+') ? `${current}+` : String(current),
      );
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

export const MarketingLanding = () => {
  const reduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '12%']);
  const imageScale = useSpring(
    useTransform(scrollYProgress, [0, 1], [1.08, 1.18]),
    { stiffness: 60, damping: 22 },
  );

  return (
    <div className="pb-12">
      <section
        ref={heroRef}
        className="relative isolate overflow-hidden"
        aria-labelledby="landing-hero-heading"
      >
        {/* Explicit product plane: always visible on mobile as its own full-bleed band */}
        <div className="relative overflow-hidden md:absolute md:inset-0 md:min-h-[min(100svh,58rem)]">
          {/* Mobile: intrinsic image band — avoids fill/transform collapse quirks */}
          <div className="relative md:hidden">
            <Image
              src={LANDING_HERO.heroImage.src}
              alt={LANDING_HERO.heroImage.alt}
              width={1400}
              height={900}
              className="h-[min(44svh,20rem)] w-full object-cover object-[72%_14%]"
              priority
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(230,238,247,0.35)_100%)]"
              aria-hidden
            />
          </div>

          {/* Desktop: full-bleed parallax plane */}
          <motion.div
            className="absolute inset-0 hidden md:block"
            style={
              reduceMotion
                ? undefined
                : { y: imageY, scale: imageScale }
            }
          >
            <Image
              src={LANDING_HERO.heroImage.src}
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-[82%_8%]"
              priority
              aria-hidden
            />
          </motion.div>
          <div
            className="absolute inset-0 hidden bg-[linear-gradient(92deg,var(--mkt-mist)_0%,var(--mkt-mist)_38%,rgba(230,238,247,0.9)_50%,rgba(230,238,247,0.35)_68%,rgba(230,238,247,0.08)_100%)] md:block"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 hidden marketing-mesh opacity-60 mix-blend-multiply md:block"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 hidden marketing-grain opacity-80 md:block"
            aria-hidden
          />
        </div>

        <div className="relative bg-[var(--mkt-mist)] md:bg-transparent">
          <div className="mx-auto flex min-h-[min(54svh,28rem)] max-w-6xl items-end px-4 pb-12 pt-8 sm:px-6 sm:pb-14 md:min-h-[min(100svh,58rem)] md:items-center md:pb-24 md:pt-24">
            <div className="max-w-xl space-y-5 sm:space-y-6">
              <BrandMark />
              <ZigZagStroke />
              <motion.h1
                id="landing-hero-heading"
                className="max-w-xl font-[family-name:var(--font-marketing-display)] text-[clamp(1.8rem,4vw,2.7rem)] font-semibold leading-[1.12] tracking-tight text-[var(--mkt-ink)]"
                initial={reduceMotion ? false : { opacity: 0, y: 22, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.55, ease: easeOut }}
              >
                {LANDING_HERO.headline}
              </motion.h1>
              <motion.p
                className="max-w-lg text-lg leading-relaxed text-[var(--mkt-muted)] sm:text-xl"
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.7, ease: easeOut }}
              >
                {LANDING_HERO.support}
              </motion.p>
              <motion.div
                className="flex flex-wrap gap-3 pt-1"
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.85, ease: easeOut }}
              >
                <Link
                  href={LANDING_HERO.primaryCta.href}
                  className="marketing-cta-shine inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--mkt-signal)] px-5 text-sm font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5 hover:bg-[var(--mkt-signal-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-signal)] focus-visible:ring-offset-2"
                >
                  {LANDING_HERO.primaryCta.label}
                </Link>
                <a
                  href={LANDING_HERO.secondaryCta.href}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--mkt-line-strong)] bg-[var(--mkt-foam)]/85 px-5 text-sm font-semibold text-[var(--mkt-ink)] transition-transform duration-300 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-signal)] focus-visible:ring-offset-2"
                >
                  {LANDING_HERO.secondaryCta.label}
                </a>
              </motion.div>
            </div>
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
          <p className="mt-5 text-lg leading-relaxed text-[var(--mkt-muted)] sm:text-xl">
            {LANDING_PROBLEM.body}
          </p>
        </section>
      </Reveal>

      <FlowMarquee />

      <section
        id="como-funciona"
        className={`${sectionClass} space-y-14`}
        aria-labelledby="como-funciona-heading"
      >
        <Reveal className="max-w-3xl space-y-3">
          <h2
            id="como-funciona-heading"
            className="font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--mkt-ink)] sm:text-5xl"
          >
            Cómo funciona
          </h2>
          <p className="text-lg text-[var(--mkt-muted)] sm:text-xl">
            Un solo flujo operativo:{' '}
            <span className="font-semibold text-[var(--mkt-ink)]">
              Cliente → Ticket → Servicios → Cobro → Factura PDF
            </span>
            .
          </p>
        </Reveal>

        <ol className="grid gap-16">
          {LANDING_FLOW_STEPS.map((step, index) => (
            <motion.li
              key={step.key}
              className="grid items-center gap-6 md:grid-cols-2 md:gap-14"
              initial={reduceMotion ? false : { opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease: easeOut }}
            >
              <div className={index % 2 === 1 ? 'md:order-2' : undefined}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mkt-signal)]">
                  Paso {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-3 font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--mkt-ink)]">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-md text-[var(--mkt-muted)] leading-relaxed">
                  {step.body}
                </p>
              </div>
              <div
                className={`group overflow-hidden border border-[var(--mkt-line)] bg-white/60 ${
                  index % 2 === 1 ? 'md:order-1' : ''
                }`}
              >
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
      </section>

      <section
        id="capacidades"
        className={`${sectionClass} space-y-12`}
        aria-labelledby="capacidades-heading"
      >
        <Reveal className="max-w-3xl space-y-3">
          <h2
            id="capacidades-heading"
            className="font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--mkt-ink)] sm:text-5xl"
          >
            Capacidades
          </h2>
          <p className="text-lg text-[var(--mkt-muted)] sm:text-xl">
            Lo esencial para operar servicios en LATAM sin fragmentar tu operación.
          </p>
        </Reveal>
        <motion.ul
          className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
          variants={reduceMotion ? undefined : stagger}
          initial={reduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {LANDING_CAPABILITIES.map((capability) => (
            <motion.li
              key={capability.title}
              className="border-t border-[var(--mkt-line-strong)] pt-5 transition-colors hover:border-[var(--mkt-signal)]"
              variants={fadeUp}
            >
              <h3 className="font-[family-name:var(--font-marketing-display)] text-lg font-semibold tracking-tight text-[var(--mkt-ink)]">
                {capability.title}
              </h3>
              <p className="mt-2 text-[var(--mkt-muted)] leading-relaxed">
                {capability.body}
              </p>
            </motion.li>
          ))}
        </motion.ul>
      </section>

      <section
        id={LANDING_DEMO.id}
        className={`${sectionClass} space-y-12`}
        aria-labelledby="demo-heading"
      >
        <Reveal className="max-w-3xl space-y-3">
          <h2
            id="demo-heading"
            className="font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--mkt-ink)] sm:text-5xl"
          >
            {LANDING_DEMO.title}
          </h2>
          <p className="text-lg text-[var(--mkt-muted)] sm:text-xl">
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
              className="overflow-hidden border border-[var(--mkt-line)] bg-white/50"
              initial={reduceMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.65, delay: index * 0.08, ease: easeOut }}
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
          className="relative overflow-hidden bg-[var(--mkt-ink)] px-6 py-14 text-white sm:px-12 sm:py-16"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          <div
            className="pointer-events-none absolute inset-0 marketing-zigzag-grid opacity-[0.14]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-10 top-0 h-full w-40 bg-[linear-gradient(90deg,rgba(26,106,239,0.35),transparent)]"
            aria-hidden
          />
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
              className="marketing-cta-shine inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 text-sm font-semibold text-[var(--mkt-ink)] transition-transform duration-300 hover:-translate-y-0.5 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {LANDING_FINAL_CTA.primaryCta.label}
            </Link>
            <a
              href={LANDING_FINAL_CTA.secondaryCta.href}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/35 px-5 text-sm font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {LANDING_FINAL_CTA.secondaryCta.label}
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  );
};
