import type { ReactNode } from 'react';
import {
  APP_CARD,
  FONT_DISPLAY,
  FONT_MONO,
  FONT_SANS,
  KICKER,
  MONEY,
  SECTION_LEAD,
  SECTION_TITLE,
  SECTION_X,
} from './landing-styles';

const PIECE = `${APP_CARD} flex w-full max-w-[400px] flex-col p-[18px]`;
const LINE = 'flex justify-between gap-3';
const SUB_LINE = `${LINE} pl-3.5 text-[#556277]`;
const MUTED = 'text-[#556277]';

const ClientPiece = () => (
  <div className={`${PIECE} gap-3.5`}>
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[17px] font-bold text-[#1D4ED8]"
      >
        H
      </span>
      <div className="flex min-w-0 flex-col">
        <strong className="text-base font-semibold">Hotel Riviera Dorada</strong>
        <span className={MUTED}>998 123 4567 · Cancún</span>
      </div>
    </div>
    <div className="flex gap-2.5">
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-[#E2E8F0] px-3 py-2.5">
        <span className={MUTED}>Tickets</span>
        <strong className="text-xl font-bold">6</strong>
      </div>
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-[#E2E8F0] px-3 py-2.5">
        <span className={MUTED}>Por cobrar</span>
        <strong className="text-xl font-bold">$1,200.00</strong>
      </div>
    </div>
    <div className={`flex items-baseline justify-between gap-2.5 ${MUTED}`}>
      <span>Último: Mantenimiento preventivo A/C</span>
      <span className={FONT_MONO}>R-0058</span>
    </div>
  </div>
);

const TicketPiece = () => (
  <div className={`${PIECE} gap-2.5`}>
    <strong className="text-[15px] font-semibold">
      Servicios <span className={`font-normal ${MUTED}`}>· 2</span>
    </strong>
    <div className={LINE}>
      <span>Mantenimiento preventivo A/C</span>
      <span className={MONEY}>$850.00</span>
    </div>
    <div className={SUB_LINE}>
      <span>Filtro deshidratador · 1 × $180.00</span>
      <span className={MONEY}>$180.00</span>
    </div>
    <div className="border-t border-[#E2E8F0]" />
    <div className={LINE}>
      <span>Recarga de gas refrigerante</span>
      <span className={MONEY}>$1,400.00</span>
    </div>
    <div className={SUB_LINE}>
      <span>Gas R-410A · 2 kg × $320.00</span>
      <span className={MONEY}>$640.00</span>
    </div>
    <div className={`${LINE} items-baseline border-t border-[#E2E8F0] pt-2.5`}>
      <span className={`text-sm font-semibold tracking-[0.08em] ${MUTED}`}>TOTAL</span>
      <strong className="text-[22px] font-bold tracking-[-0.01em]">$3,070.00</strong>
    </div>
  </div>
);

const RADIO_OPTION = 'flex items-center gap-2.5 rounded-[10px] px-3 py-2.5';
const RADIO_OFF = 'size-4 shrink-0 rounded-full border-[1.5px] border-[#94A3B8]';

const PaymentPiece = () => (
  <div className={`${PIECE} gap-2`}>
    <strong className="text-[15px] font-semibold">¿Cómo pagó el cliente?</strong>
    <div className={`${RADIO_OPTION} border border-[#E2E8F0]`}>
      <span aria-hidden className={RADIO_OFF} />
      <span className="flex-1">Pagó todo</span>
      <span className={MUTED}>$3,070.00</span>
    </div>
    <div className={`${RADIO_OPTION} border-[1.5px] border-[var(--pt-app-blue)] bg-[#EFF6FF]`}>
      <span
        aria-hidden
        className="box-border size-4 shrink-0 rounded-full border-[5px] border-[var(--pt-app-blue)] bg-white"
      />
      <span className="flex-1 font-semibold">Pagó una parte</span>
      <span className={`rounded-lg border border-[#94A3B8] bg-white px-2.5 py-1 ${FONT_MONO}`}>
        $1,500.00
      </span>
    </div>
    <div className={`${RADIO_OPTION} border border-[#E2E8F0]`}>
      <span aria-hidden className={RADIO_OFF} />
      <span className="flex-1">Aún no paga</span>
      <span className={MUTED}>Queda pendiente</span>
    </div>
    <div className={`${LINE} items-baseline pt-2`}>
      <span className={MUTED}>Saldo por cobrar</span>
      <strong className="text-xl font-bold">$1,570.00</strong>
    </div>
  </div>
);

const RECEIPT_ROW = 'flex justify-between gap-2';

const ReceiptPiece = () => (
  <div className="flex w-full max-w-[400px] flex-wrap items-end justify-center gap-4">
    <div className="w-[200px] shrink-0 -rotate-3 drop-shadow-[0_16px_20px_rgba(23,20,15,0.2)]">
      <div
        className={`zz-edge-y-sm bg-[var(--pt-ground)] px-4 pt-[22px] pb-6 ${FONT_MONO} text-[12px] leading-[1.5] text-[var(--pt-ink)]`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className={`${FONT_SANS} text-[15px] font-bold`}>RECIBO</span>
          <span className="text-[var(--pt-muted)]">R-0062</span>
        </div>
        <div className="my-2 border-t-2 border-[var(--pt-ink)]" />
        <div className={`${FONT_SANS} font-semibold`}>Hotel Riviera Dorada</div>
        <div className={`${RECEIPT_ROW} mt-2`}>
          <span>Total</span>
          <span>$3,070.00</span>
        </div>
        <div className={RECEIPT_ROW}>
          <span>Pagado</span>
          <span>$1,500.00</span>
        </div>
        <div className={`${RECEIPT_ROW} mt-1 border-t border-[var(--pt-ink)] pt-1 font-semibold`}>
          <span>Saldo</span>
          <span>$1,570.00</span>
        </div>
      </div>
    </div>
    <div className="flex min-w-0 flex-[1_1_150px] flex-col gap-2.5 text-sm text-[#0B1220]">
      <span className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--pt-app-blue)] px-4 font-semibold text-white">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6" />
        </svg>
        Compartir recibo
      </span>
      <div className="flex flex-col gap-0.5 rounded-[14px_14px_2px_14px] bg-[#D7F5CE] px-3 py-2.5 text-[#111B14]">
        <strong className="font-semibold">Recibo R-0062.pdf</strong>
        <span className="text-[#3F5245]">Enviado · 5:40 p. m.</span>
      </div>
    </div>
  </div>
);

type Step = {
  n: string;
  title: string;
  body: string;
  piece: ReactNode;
  /** Piece on the left on desktop. Phones always show text first. */
  reverse: boolean;
};

const COMO_FUNCIONA_STEPS: Step[] = [
  {
    n: '01',
    title: 'Guarda al cliente una vez',
    body: 'Nombre, teléfono y dirección. La próxima vez ya está ahí, con todo lo que le has hecho y lo que te debe.',
    piece: <ClientPiece />,
    reverse: false,
  },
  {
    n: '02',
    title: 'Arma el ticket en la obra',
    body: 'Elige servicios de tu lista de precios, agrega los materiales que usaste y ZigZag hace la suma.',
    piece: <TicketPiece />,
    reverse: true,
  },
  {
    n: '03',
    title: 'Anota cómo te pagaron',
    body: 'Todo, una parte o nada todavía. El saldo se calcula solo y queda a la vista hasta que te lo paguen.',
    piece: <PaymentPiece />,
    reverse: false,
  },
  {
    n: '04',
    title: 'Manda el recibo',
    body: 'Un PDF limpio, con tu logo y tu folio, directo al WhatsApp del cliente. Queda guardado por si te lo vuelven a pedir.',
    piece: <ReceiptPiece />,
    reverse: true,
  },
];

/**
 * Dotted orange diagonal that zigzags from one step's piece to the next.
 * `fromRight` starts at the right (into steps 02 and 04). Static: no
 * draw-on-scroll, so nothing depends on motion.
 */
const StepConnector = ({ fromRight }: { fromRight: boolean }) => (
  <svg
    aria-hidden
    data-testid="step-connector"
    viewBox="0 0 100 10"
    preserveAspectRatio="none"
    className="block h-[clamp(48px,6vw,84px)] w-full"
  >
    <path
      d={fromRight ? 'M75 0.6L25 9.4' : 'M25 0.6L75 9.4'}
      fill="none"
      stroke="var(--pt-button-to)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeDasharray="1 11"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

/** ZIG-I39-3: section id="como-funciona" on a paper band with zigzag edges. */
export const LandingComoFunciona = () => (
  <section
    id="como-funciona"
    aria-labelledby="zz-como-funciona"
    className={`zz-edge-y bg-[var(--pt-paper)] ${SECTION_X} py-[clamp(78px,9vw,134px)]`}
  >
    <div className="mx-auto max-w-[1080px]">
      <p className={`mb-4 ${KICKER}`}>Cómo funciona</p>
      <h2 id="zz-como-funciona" className={`max-w-[14em] ${SECTION_TITLE}`}>
        Del trabajo al cobro, en zigzag.
      </h2>
      <p className={`mt-5 mb-[clamp(40px,5vw,72px)] max-w-[32em] ${SECTION_LEAD}`}>
        Cuatro pasos. Los de siempre, pero ya no se te pierde ninguno.
      </p>

      <ol className="m-0 list-none p-0">
        {COMO_FUNCIONA_STEPS.map((step, index) => (
          <li key={step.n}>
            {index > 0 ? <StepConnector fromRight={step.reverse} /> : null}
            <div
              data-testid="como-funciona-step"
              className={`flex flex-col gap-[clamp(24px,5vw,80px)] md:items-center ${
                step.reverse ? 'md:flex-row-reverse' : 'md:flex-row'
              }`}
            >
              <div className="min-w-0 md:flex-1">
                <span className={`${FONT_MONO} text-sm font-semibold text-[var(--pt-accent)]`}>
                  {step.n}
                </span>
                <h3
                  className={`mt-2 mb-3 ${FONT_DISPLAY} text-[clamp(26px,2.8vw,38px)] leading-[1.08] font-bold tracking-[-0.025em]`}
                >
                  {step.title}
                </h3>
                <p className="max-w-[30em] text-[var(--pt-body)]">{step.body}</p>
              </div>
              <div className="flex min-w-0 justify-center md:flex-1" data-testid="como-funciona-piece">
                {step.piece}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  </section>
);
