import type { ReactNode } from 'react';
import { CobranzaDemo, TextoGrandeDemo } from './landing-funciones-demos';
import {
  FONT_DISPLAY,
  FONT_MONO,
  KICKER,
  SECTION_LEAD,
  SECTION_TITLE,
  SECTION_X,
} from './landing-styles';

const TILE =
  'flex min-w-0 flex-col gap-4 rounded-[28px] border border-[var(--pt-line)] bg-[var(--pt-paper)] p-6';
const PIECE = 'rounded-[14px] border border-[#E2E8F0] bg-white text-sm text-[#0B1220]';
const MUTED = 'text-[#556277]';
const CHIP = 'whitespace-nowrap rounded-full px-2.5 py-[3px] text-sm font-semibold';

const Tile = ({
  kicker,
  title,
  className = '',
  children,
}: {
  kicker: string;
  title: string;
  className?: string;
  children: ReactNode;
}) => (
  <div className={`${TILE} ${className}`} data-testid="funciones-tile">
    <div>
      <span className={KICKER}>{kicker}</span>
      <h3
        className={`mt-2 ${FONT_DISPLAY} text-[22px] leading-[1.12] font-bold tracking-[-0.02em]`}
      >
        {title}
      </h3>
    </div>
    {children}
  </div>
);

const Allowed = ({ on }: { on: boolean }) =>
  on ? (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      role="img"
      aria-label="Permitido"
      fill="none"
      stroke="#047857"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      role="img"
      aria-label="No permitido"
      fill="none"
      stroke="#64748B"
      strokeWidth="2.6"
      strokeLinecap="round"
    >
      <path d="M7 12h10" />
    </svg>
  );

const ROLE_GRID = 'grid grid-cols-[minmax(0,1fr)_56px_56px] items-center py-2.5';
const PERMISSIONS: [string, boolean, boolean][] = [
  ['Tickets', true, true],
  ['Clientes', true, false],
  ['Cobranza', false, false],
];

/** ZIG-I39-4: section id="funciones": Cobranza demo plus five small tiles. */
export const LandingFunciones = () => (
  <section
    id="funciones"
    aria-labelledby="zz-funciones"
    className={`${SECTION_X} py-[clamp(64px,8vw,112px)]`}
  >
    <div className="mx-auto max-w-[1180px]">
      <p className={`mb-4 ${KICKER}`}>Después del trabajo</p>
      <h2 id="zz-funciones" className={`max-w-[16em] ${SECTION_TITLE}`}>
        Lo que pasa después del trabajo también es trabajo.
      </h2>
      <p className={`mt-5 mb-[clamp(32px,4vw,48px)] max-w-[32em] ${SECTION_LEAD}`}>
        ZigZag se encarga de esa parte.
      </p>

      <div className="flex flex-wrap gap-4">
        <CobranzaDemo />

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <Tile
            kicker="Presupuestos"
            title="Del presupuesto al ticket sin volver a escribir."
            className="flex-auto"
          >
            <div className={`${PIECE} flex flex-col gap-2 px-3.5 py-3`}>
              <div className="flex items-baseline justify-between gap-2.5">
                <strong className="font-semibold">Gimnasio FitPro</strong>
                <span className={`${FONT_MONO} ${MUTED} md:text-[13px]`}>P-0031</span>
              </div>
              <div className="flex items-center justify-between gap-2.5">
                <span className="flex items-center gap-1.5 font-semibold text-[#065F46]">
                  <span aria-hidden className="size-2 rounded-full bg-[#047857]" />
                  Aceptado
                </span>
                <strong className="font-semibold">$4,850.00</strong>
              </div>
              <span className="flex h-10 items-center justify-center rounded-[10px] border-[1.5px] border-[var(--pt-app-blue)] font-semibold text-[#1D4ED8]">
                Convertir a ticket
              </span>
            </div>
          </Tile>

          <Tile
            kicker="Recordatorios"
            title="El mantenimiento de cada seis meses ya no se te pasa."
            className="flex-auto"
          >
            <div className={`${PIECE} flex flex-col px-3.5 py-1`}>
              <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5 border-b border-[#E2E8F0] py-2.5">
                <div className="flex min-w-0 flex-[1_1_150px] flex-col">
                  <strong className="font-semibold">Hotel Riviera Dorada</strong>
                  <span className={MUTED}>Mantenimiento A/C · cada 6 meses</span>
                </div>
                <span className={`${CHIP} bg-[#FEF3C7] text-[#78350F]`}>Próximo · 12 días</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5 py-2.5">
                <div className="flex min-w-0 flex-[1_1_150px] flex-col">
                  <strong className="font-semibold">Plaza Comercial Aurora</strong>
                  <span className={MUTED}>Revisión eléctrica · cada año</span>
                </div>
                <span className={`${CHIP} bg-[#B42318] text-white`}>Atrasado · 4 días</span>
              </div>
            </div>
          </Tile>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <Tile
          kicker="Sin señal"
          title="¿Sótano sin señal? Guarda el ticket igual."
          className="flex-[1_1_280px]"
        >
          <div className={`${PIECE} flex flex-col gap-2 px-3.5 py-3`}>
            <span className="flex items-center gap-2 font-semibold">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.5M19 13a10 10 0 0 0-5-2.8M12 20h.01" />
              </svg>
              Tickets sin sincronizar
            </span>
            <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5">
              <span>Sra. Lupita · $3,000.00</span>
              <span className={`${CHIP} bg-[#E2E8F0] text-[#334155]`}>Pendiente de sincronizar</span>
            </div>
            <span className={MUTED}>Sin folio todavía. Se sube solo cuando vuelve la señal.</span>
          </div>
        </Tile>

        <Tile
          kicker="Texto grande"
          title="Letras grandes con un toque."
          className="flex-[1_1_280px]"
        >
          <TextoGrandeDemo />
        </Tile>

        <Tile kicker="Tu equipo" title="Cada quien ve lo que le toca." className="flex-[1_1_280px]">
          <div className={`${PIECE} flex flex-col px-3.5 py-1`}>
            <div className={`${ROLE_GRID} border-b border-[#E2E8F0] ${MUTED}`}>
              <span>Rol: Técnico</span>
              <span className="text-center">Ver</span>
              <span className="text-center">Editar</span>
            </div>
            {PERMISSIONS.map(([area, canView, canEdit], index) => (
              <div
                key={area}
                className={`${ROLE_GRID} justify-items-center ${
                  index < PERMISSIONS.length - 1 ? 'border-b border-[#E2E8F0]' : ''
                }`}
              >
                <span className="justify-self-start font-medium">{area}</span>
                <Allowed on={canView} />
                <Allowed on={canEdit} />
              </div>
            ))}
          </div>
        </Tile>
      </div>
    </div>
  </section>
);
