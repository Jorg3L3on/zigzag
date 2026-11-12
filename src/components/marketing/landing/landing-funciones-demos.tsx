'use client';

import { useState } from 'react';
import { FONT_DISPLAY, FONT_MONO, formatMoney } from './landing-styles';

export type LandingDebt = {
  id: string;
  client: string;
  what: string;
  days: number;
  amount: number;
};

/** Demo data from the canvas. Nothing here touches the app or the network. */
export const LANDING_DEBTS: LandingDebt[] = [
  { id: 'd1', client: 'Restaurante Mar & Tierra', what: 'Destape de drenaje', days: 34, amount: 2100 },
  { id: 'd2', client: 'Sra. Lupita', what: 'Instalación de minisplit', days: 21, amount: 1200 },
  { id: 'd3', client: 'Gimnasio FitPro', what: 'Cambio de contactos', days: 9, amount: 1350 },
  { id: 'd4', client: 'Plaza Comercial Aurora', what: 'Impermeabilización de azotea', days: 3, amount: 1000 },
];

/**
 * Age chip: older debts get a darker, warmer chip so the age reads by
 * lightness as well as by colour (all pairs ≥ 4.5:1).
 */
const ageChipClass = (days: number, paid: boolean) => {
  if (paid) return 'bg-[#D1FAE5] text-[#065F46]';
  if (days > 30) return 'bg-[#B42318] text-white';
  if (days > 14) return 'bg-[#FCD34D] text-[#78350F]';
  return 'border border-[#CBD5E1] bg-[#F8FAFC] text-[#334155]';
};

export const countLabel = (count: number) => (count === 1 ? '1 saldo' : `${count} saldos`);

/** Dark Cobranza tile: "Registrar pago" marks a row paid; "Deshacer" brings it back. */
export const CobranzaDemo = ({ debts = LANDING_DEBTS }: { debts?: LandingDebt[] }) => {
  const [paid, setPaid] = useState<Record<string, boolean>>({});
  const open = debts.filter((debt) => !paid[debt.id]);
  const total = open.reduce((sum, debt) => sum + debt.amount, 0);

  return (
    <div
      data-testid="cobranza-tile"
      className="flex min-w-0 flex-[2_1_520px] flex-col gap-5 rounded-[28px] bg-[var(--pt-ink)] p-[clamp(20px,2.6vw,32px)] text-[var(--pt-ground)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-[1_1_260px]">
          <span
            className={`${FONT_MONO} text-sm font-medium uppercase tracking-[0.08em] text-[var(--pt-orange-from)] md:text-[13px]`}
          >
            Cobranza
          </span>
          <h3
            className={`mt-2 ${FONT_DISPLAY} text-[clamp(24px,2.4vw,32px)] leading-[1.08] font-bold tracking-[-0.025em]`}
          >
            Quién te debe, cuánto y desde cuándo.
          </h3>
        </div>
        <div className="flex flex-col" aria-live="polite" data-testid="cobranza-total">
          <span
            className={`${FONT_MONO} text-sm uppercase tracking-[0.06em] text-[#B8AE9F] md:text-[12px]`}
          >
            Por cobrar · {countLabel(open.length)}
          </span>
          <strong
            className={`${FONT_DISPLAY} text-[clamp(32px,3.4vw,46px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-[var(--pt-orange-from)]`}
          >
            {formatMoney(total)}
          </strong>
        </div>
      </div>

      <ul className="m-0 flex list-none flex-col rounded-[18px] bg-white px-4 py-1.5 text-sm text-[#0B1220]">
        {debts.map((debt) => {
          const done = Boolean(paid[debt.id]);
          return (
            <li
              key={debt.id}
              data-testid="cobranza-row"
              className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-[#E2E8F0] py-3 last:border-b-0"
            >
              <div className="flex min-w-0 flex-[1_1_180px] flex-col">
                <strong className="text-[15px] font-semibold">{debt.client}</strong>
                <span className="text-[#556277]">{debt.what}</span>
              </div>
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-[3px] text-sm font-semibold ${ageChipClass(debt.days, done)}`}
              >
                {done ? 'Pagado hoy' : `Hace ${debt.days} días`}
              </span>
              <span className={`w-[92px] whitespace-nowrap text-right ${FONT_MONO} font-medium`}>
                {formatMoney(done ? 0 : debt.amount)}
              </span>
              <button
                type="button"
                aria-label={`${done ? 'Deshacer' : 'Registrar pago'}, ${debt.client}`}
                onClick={() => setPaid((prev) => ({ ...prev, [debt.id]: !done }))}
                className={`zz-btn min-h-11 min-w-[132px] cursor-pointer rounded-[10px] border-[1.5px] px-3.5 text-sm font-semibold ${
                  done
                    ? 'border-[#94A3B8] bg-white text-[#0B1220]'
                    : 'border-[var(--pt-app-blue)] bg-[var(--pt-app-blue)] text-white'
                }`}
              >
                {done ? 'Deshacer' : 'Registrar pago'}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-[#B8AE9F]">
        Toca “Registrar pago” y mira cómo baja lo que te deben.
      </p>
    </div>
  );
};

/** Texto grande tile: a real switch that enlarges the sample row. */
export const TextoGrandeDemo = () => {
  const [big, setBig] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] border border-[#E2E8F0] bg-white px-3.5 pt-1.5 pb-3.5 text-[#0B1220]">
      <div className="flex items-center justify-between gap-2.5 text-[15px] font-medium">
        <span>Texto grande</span>
        <button
          type="button"
          role="switch"
          aria-checked={big}
          aria-label="Texto grande"
          onClick={() => setBig((value) => !value)}
          className="relative h-11 w-[60px] shrink-0 cursor-pointer border-0 bg-transparent p-0"
        >
          <span
            aria-hidden
            className={`absolute top-2 left-1 h-7 w-[52px] rounded-full ${big ? 'bg-[var(--pt-app-blue)]' : 'bg-[#64748B]'}`}
          />
          <span
            aria-hidden
            className={`absolute top-[11px] size-[22px] rounded-full bg-white ${big ? 'left-[31px]' : 'left-[7px]'}`}
          />
        </button>
      </div>
      <div
        data-testid="texto-grande-sample"
        className="flex flex-col gap-0.5 border-t border-[#E2E8F0] pt-2.5"
      >
        <strong
          className={`leading-[1.25] font-semibold ${big ? 'text-[22px]' : 'text-[15px]'}`}
        >
          Hotel Riviera Dorada
        </strong>
        <span className={`leading-[1.3] text-[#334155] ${big ? 'text-lg' : 'text-sm'}`}>
          Saldo $1,200.00
        </span>
      </div>
    </div>
  );
};
