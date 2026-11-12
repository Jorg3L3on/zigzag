'use client';

import { useState } from 'react';
import {
  HERO_DEFAULT_SELECTION,
  HERO_PAY_MODES,
  HERO_TRADES,
  computeHeroReceipt,
  formatHeroMoney,
  type HeroPayMode,
  type HeroReceiptStatus,
  type HeroTradeId,
} from '@/components/marketing/landing/landing-hero-data';

type LandingHeroProps = {
  /** Trade selected on first render (default: Clima). */
  defaultTrade?: HeroTradeId;
};

const MONO = 'font-[family-name:var(--font-marketing-mono)]';
const DISPLAY = 'font-[family-name:var(--font-marketing-display)]';

/**
 * Mock text: phones get at least 12px (the mock is a scaled picture of the
 * app); from lg the canvas sizes (9–13px) apply.
 */
const MOCK_META = 'text-[12px] lg:text-[11px]';

const STATUS_DOT: Record<HeroReceiptStatus, string> = {
  PAGADO: 'bg-[#047857]',
  'PAGO PARCIAL': 'bg-[#F59E0B]',
  PENDIENTE: 'bg-[#64748B]',
  'SIN SERVICIOS': 'bg-[#64748B]',
};

const ArrowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/**
 * Landing hero ("Papel y tinta"): headline, CTAs and the live demo — pick a
 * trade, add or remove services, choose how the client paid, and the receipt
 * behind the phone follows.
 */
export const LandingHero = ({ defaultTrade = 'clima' }: LandingHeroProps) => {
  const [tradeId, setTradeId] = useState<HeroTradeId>(defaultTrade);
  const [selected, setSelected] = useState<boolean[]>([...HERO_DEFAULT_SELECTION]);
  const [payMode, setPayMode] = useState<HeroPayMode>('full');

  const trade = HERO_TRADES.find((t) => t.id === tradeId) ?? HERO_TRADES[0];
  const services = trade.services.map((service, index) => ({
    ...service,
    index,
    price: formatHeroMoney(service.amount),
  }));
  const lines = services.filter((s) => selected[s.index]);
  const adds = services.filter((s) => !selected[s.index]);
  const receipt = computeHeroReceipt(
    lines.map((l) => l.amount),
    payMode,
  );
  const total = formatHeroMoney(receipt.total);
  const countLabel = lines.length === 1 ? '1 servicio' : `${lines.length} servicios`;

  const pickTrade = (id: HeroTradeId) => {
    setTradeId(id);
    setSelected([...HERO_DEFAULT_SELECTION]);
  };
  const toggleService = (index: number) =>
    setSelected((prev) => prev.map((on, i) => (i === index ? !on : on)));

  return (
    <section
      aria-labelledby="landing-hero-title"
      className="px-4 pt-[clamp(24px,3vw,40px)] pb-[clamp(56px,7vw,96px)] sm:px-[clamp(16px,4vw,40px)]"
    >
      <div className="mx-auto max-w-[1180px]">
        <p
          className={`${MONO} mb-[clamp(18px,2.4vw,30px)] text-sm font-medium tracking-[0.08em] text-[var(--pt-accent)] uppercase lg:text-[13px]`}
        >
          Tickets, cobranza y recibos para negocios de servicio
        </p>
        <h1
          id="landing-hero-title"
          className={`${DISPLAY} text-[clamp(36px,8vw,116px)] leading-[0.94] font-extrabold tracking-[-0.045em]`}
        >
          <span className="block">Haz el trabajo.</span>
          <span className="block pl-[clamp(16px,11.8vw,170px)]">Manda el recibo.</span>
          <span className="block">
            Cobra <span className="text-[#E8482E]">completo.</span>
          </span>
        </h1>

        <div className="mt-[clamp(32px,4.4vw,60px)] flex flex-wrap items-start gap-[clamp(32px,5vw,72px)]">
          {/* Copy, CTAs and trade picker */}
          <div className="flex max-w-[520px] min-w-0 flex-[1_1_340px] flex-col gap-6">
            <p className="text-[clamp(18px,1.5vw,21px)] leading-[1.5] text-[var(--pt-body)]">
              ZigZag lleva tus tickets, presupuestos y cobros desde el teléfono. Sabes
              quién te debe y cuánto, y mandas el recibo por WhatsApp antes de irte.
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <a
                href="#acceso"
                className="zz-btn inline-flex min-h-14 items-center gap-2.5 rounded-[14px] bg-[linear-gradient(135deg,var(--pt-orange-from),var(--pt-button-to))] px-[26px] text-lg font-bold text-[var(--pt-ink)] no-underline shadow-[0_12px_26px_-12px_rgba(232,72,46,0.65)] hover:text-[var(--pt-ink)]"
              >
                Pedir acceso
                <ArrowIcon />
              </a>
              <a
                href="#como-funciona"
                className="inline-flex min-h-14 items-center px-3.5 text-[17px] font-semibold text-[var(--pt-ink)] underline underline-offset-[5px] hover:text-[var(--pt-accent)]"
              >
                Ver cómo funciona
              </a>
            </div>
            <p className="text-[15px] text-[var(--pt-muted)]">
              Nosotros damos de alta tu empresa. Tú entras desde tu teléfono, sin tienda
              de apps.
            </p>
            <div className="mt-2 flex flex-col gap-2.5">
              <span
                className={`${MONO} text-sm font-medium tracking-[0.08em] text-[var(--pt-muted)] uppercase lg:text-[12px]`}
              >
                Pruébalo con tu oficio
              </span>
              <div
                role="group"
                aria-label="Oficio"
                className="flex flex-wrap gap-2"
              >
                {HERO_TRADES.map((t) => {
                  const on = t.id === trade.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickTrade(t.id)}
                      className={`min-h-11 cursor-pointer rounded-full border-[1.5px] px-4 text-[15px] font-semibold ${
                        on
                          ? 'border-[var(--pt-ink)] bg-[var(--pt-ink)] text-[var(--pt-ground)]'
                          : 'border-[rgba(23,20,15,0.4)] bg-transparent text-[var(--pt-ink)]'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Phone + receipt: stacked on phones, overlapped from sm */}
          <div className="flex w-full min-w-0 flex-col items-center sm:w-auto sm:flex-[1.3_1_470px] sm:flex-row sm:flex-wrap sm:items-start sm:justify-center">
            <div
              role="group"
              aria-label="Ejemplo: nuevo ticket"
              className="relative z-[2] w-[292px] max-w-full flex-none rounded-[40px] bg-[var(--pt-ink)] p-[9px] shadow-[0_34px_60px_-28px_rgba(23,20,15,0.55)]"
            >
              <div className="overflow-hidden rounded-[31px] bg-[#F1F5F9] font-[family-name:var(--font-marketing-sans)] text-sm leading-[1.35] text-[#0B1220] lg:text-[13px]">
                <div className="flex items-center gap-2.5 border-b border-[#E2E8F0] bg-white px-3.5 pt-4 pb-3">
                  <span
                    aria-hidden="true"
                    className="flex size-[30px] flex-none items-center justify-center rounded-full border border-[#E2E8F0]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M19 12H5M11 6l-6 6 6 6" />
                    </svg>
                  </span>
                  <div className="flex flex-col">
                    <strong className="font-semibold">Nuevo ticket</strong>
                    <span className={`${MOCK_META} text-[#556277]`}>
                      Cliente, servicios y total
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 p-2.5">
                  <div className="flex items-center gap-2.5 rounded-[14px] border border-[#E2E8F0] bg-white px-3 py-2.5">
                    <span
                      aria-hidden="true"
                      className="flex size-8 flex-none items-center justify-center rounded-full bg-[#DBEAFE] font-semibold text-[#1D4ED8]"
                    >
                      {trade.client.charAt(0)}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <strong
                        data-testid="hero-phone-client"
                        className="truncate font-semibold"
                      >
                        {trade.client}
                      </strong>
                      <span className={`${MOCK_META} text-[#556277]`}>
                        {trade.clientSub}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 rounded-[14px] border border-[#E2E8F0] bg-white p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <strong className="font-semibold">
                        Servicios{' '}
                        <span className="font-normal text-[#556277]">· {lines.length}</span>
                      </strong>
                      <span className={`${MOCK_META} text-[#556277]`}>Toca para quitar</span>
                    </div>
                    {lines.map((line) => (
                      <button
                        key={line.name}
                        type="button"
                        aria-label={`Quitar ${line.name}`}
                        onClick={() => toggleService(line.index)}
                        className="flex min-h-11 cursor-pointer items-center justify-between gap-2 border-0 border-b border-[#E2E8F0] bg-transparent py-1 text-left"
                      >
                        <span>{line.name}</span>
                        <span className={`${MONO} text-[12px] whitespace-nowrap`}>
                          {line.price}
                        </span>
                      </button>
                    ))}
                    {adds.map((add) => (
                      <button
                        key={add.name}
                        type="button"
                        aria-label={`Agregar ${add.name}`}
                        onClick={() => toggleService(add.index)}
                        className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-[10px] border-[1.5px] border-dashed border-[#94A3B8] bg-[#F8FAFC] px-2.5 text-left text-[12px] font-semibold text-[#1D4ED8]"
                      >
                        <span>+ {add.name}</span>
                        <span
                          className={`${MONO} font-medium whitespace-nowrap text-[#334155]`}
                        >
                          {add.price}
                        </span>
                      </button>
                    ))}
                    <div className="flex items-baseline justify-between pt-1.5">
                      <span
                        className={`${MOCK_META} font-semibold tracking-[0.08em] text-[#556277]`}
                      >
                        TOTAL
                      </span>
                      <strong
                        data-testid="hero-phone-total"
                        className="text-[19px] font-bold tracking-[-0.01em]"
                      >
                        {total}
                      </strong>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 rounded-[14px] border border-[#E2E8F0] bg-white p-3">
                    <strong className="font-semibold">¿Cómo pagó el cliente?</strong>
                    <div
                      role="group"
                      aria-label="¿Cómo pagó el cliente?"
                      className="flex gap-1.5"
                    >
                      {HERO_PAY_MODES.map((mode) => {
                        const on = mode.id === payMode;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setPayMode(mode.id)}
                            className={`h-11 min-h-11 min-w-0 flex-[1_1_0] cursor-pointer rounded-[10px] border-[1.5px] px-0.5 text-[12px] text-[#0B1220] ${
                              on
                                ? 'border-[#2563EB] bg-[#DBEAFE] font-semibold'
                                : 'border-[#E2E8F0] bg-white font-normal'
                            }`}
                          >
                            {mode.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2.5 border-t border-[#E2E8F0] bg-white px-3 pt-2.5 pb-3.5">
                  <div className="flex flex-col">
                    <span className={`${MOCK_META} text-[#556277]`}>{countLabel}</span>
                    <strong className="text-sm">{total}</strong>
                  </div>
                  {/* Decorative: the demo has nothing to save. */}
                  <span
                    aria-hidden="true"
                    className="inline-flex h-11 items-center rounded-xl bg-[#2563EB] px-[22px] font-semibold text-white"
                  >
                    Guardar
                  </span>
                </div>
              </div>
            </div>

            <div
              role="group"
              aria-label="Ejemplo: recibo"
              className="relative z-[1] mt-6 w-full max-w-[320px] flex-none drop-shadow-[0_18px_22px_rgba(23,20,15,0.22)] sm:mt-16 sm:-ml-[34px] sm:w-[248px] sm:rotate-3"
            >
              <div
                className={`zz-edge-y-sm bg-[var(--pt-paper)] px-[22px] pt-[26px] pb-7 ${MONO} text-[12px] leading-[1.5] text-[var(--pt-ink)] sm:pr-5 sm:pl-[50px] lg:text-[11px]`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="flex size-6 flex-none items-center justify-center rounded-full border-[1.5px] border-[var(--pt-ink)] text-[7px] font-semibold"
                    >
                      LOGO
                    </span>
                    <span className="font-[family-name:var(--font-marketing-sans)] font-semibold">
                      Tu negocio
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-[family-name:var(--font-marketing-sans)] text-[17px] leading-none font-bold tracking-[0.02em]">
                      RECIBO
                    </div>
                    <div className="text-[var(--pt-muted)] lg:text-[10px]">Folio R-0062</div>
                  </div>
                </div>
                <div className="mt-3 mb-2.5 border-t-2 border-[var(--pt-ink)]" />
                <div className="tracking-[0.12em] text-[var(--pt-muted)] lg:text-[9px]">
                  CLIENTE
                </div>
                <div
                  data-testid="hero-receipt-client"
                  className="font-[family-name:var(--font-marketing-sans)] font-semibold lg:text-[12px]"
                >
                  {trade.client}
                </div>
                <div className="mt-2.5 mb-1.5 border-t border-[var(--pt-ink)]" />
                <ul>
                  {lines.map((line) => (
                    <li
                      key={line.name}
                      className="flex justify-between gap-2 border-b border-dashed border-[rgba(23,20,15,0.3)] py-[5px]"
                    >
                      <span className="font-[family-name:var(--font-marketing-sans)]">
                        {line.name}
                      </span>
                      <span className="whitespace-nowrap">{line.price}</span>
                    </li>
                  ))}
                </ul>
                <div
                  aria-live="polite"
                  className="mt-3 flex flex-col gap-1 bg-[#F1ECE1] p-2.5"
                >
                  <div className="flex justify-between gap-2">
                    <span>Total</span>
                    <span data-testid="hero-receipt-total">{total}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Pagado</span>
                    <span data-testid="hero-receipt-paid">
                      {formatHeroMoney(receipt.paid)}
                    </span>
                  </div>
                  {receipt.owes ? (
                    <div className="mt-0.5 flex justify-between gap-2 border-t border-[var(--pt-ink)] pt-1.5 font-semibold">
                      <span className="font-[family-name:var(--font-marketing-sans)]">
                        Saldo por pagar
                      </span>
                      <span data-testid="hero-receipt-saldo">
                        {formatHeroMoney(receipt.saldo)}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span
                    data-testid="hero-receipt-status"
                    className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[var(--pt-ink)] px-[9px] py-0.5 font-semibold tracking-[0.1em] lg:text-[10px]"
                  >
                    <span
                      aria-hidden="true"
                      className={`size-1.5 rounded-full ${STATUS_DOT[receipt.status]}`}
                    />
                    {receipt.status}
                  </span>
                  <span className="text-[var(--pt-muted)] lg:text-[9px]">Hecho con ZigZag</span>
                </div>
              </div>
              <div className="mt-3.5 inline-flex items-center gap-2 rounded-full bg-[var(--pt-ink)] px-3.5 py-2 font-[family-name:var(--font-marketing-sans)] text-sm font-medium text-[var(--pt-ground)] sm:ml-11 sm:-rotate-[5deg] lg:text-[13px]">
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  fill="none"
                  stroke="#6EE7B7"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                Enviado por WhatsApp
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
