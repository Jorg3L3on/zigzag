import { FONT_MONO, SECTION_LEAD, SECTION_TITLE, SECTION_X } from './landing-styles';

const SIDEBAR_ITEMS = [
  'Inicio',
  'Tickets',
  'Cobranza',
  'Presupuestos',
  'Recordatorios de servicio',
  'Servicios',
  'Clientes',
  'Mi empresa',
];

const DOT = {
  partial: 'bg-[#F59E0B]',
  pending: 'bg-[#64748B]',
  progress: 'bg-[#0EA5E9]',
  paid: 'bg-[#047857]',
} as const;

const TABS: { label: string; dot?: keyof typeof DOT }[] = [
  { label: 'Todos · 60' },
  { label: 'Por cobrar · 26', dot: 'partial' },
  { label: 'En proceso · 4', dot: 'progress' },
  { label: 'Pagados · 30', dot: 'paid' },
];

type Row = {
  folio: string;
  client: string;
  date: string;
  total: string;
  saldo: string;
  status: string;
  dot: keyof typeof DOT;
};

const ROWS: Row[] = [
  { folio: 'R-0062', client: 'Hotel Riviera Dorada', date: '11 nov', total: '$3,070.00', saldo: '$1,570.00', status: 'Pago parcial', dot: 'partial' },
  { folio: 'R-0061', client: 'Restaurante Mar & Tierra', date: '10 nov', total: '$2,100.00', saldo: '$2,100.00', status: 'Pendiente de pago', dot: 'pending' },
  { folio: 'R-0060', client: 'Gimnasio FitPro', date: '9 nov', total: '$2,850.00', saldo: '$0.00', status: 'Pagado', dot: 'paid' },
  { folio: 'R-0059', client: 'Plaza Comercial Aurora', date: '7 nov', total: '$7,700.00', saldo: '$1,000.00', status: 'Pago parcial', dot: 'partial' },
  { folio: 'R-0058', client: 'Sra. Lupita', date: '7 nov', total: '$3,000.00', saldo: '$1,200.00', status: 'Pago parcial', dot: 'partial' },
];

const TABLE_GRID =
  'grid grid-cols-[64px_minmax(0,1.6fr)_62px_88px_88px_128px] items-center gap-2.5';

const Dot = ({ tone }: { tone: keyof typeof DOT }) => (
  <span aria-hidden className={`size-[7px] shrink-0 rounded-full ${DOT[tone]}`} />
);

/**
 * Desktop tickets screen. It keeps its 720px layout and crops on the right
 * inside its own overflow-hidden box, so narrow screens never scroll sideways.
 */
const DesktopMock = () => (
  <div
    data-testid="desktop-mock"
    className="min-w-0 flex-[1_1_520px] overflow-hidden rounded-[18px] border border-[var(--pt-line-strong)] bg-white shadow-[0_30px_60px_-34px_rgba(23,20,15,0.5)]"
  >
    <div className="flex min-w-[720px] text-[12px] leading-[1.35] text-[#0B1220] md:text-[13px]">
      <div className="flex w-[190px] shrink-0 flex-col gap-0.5 border-r border-[#E2E8F0] bg-[#FAFAFA] px-2.5 py-3.5">
        <div className="flex items-center gap-2 px-1.5 pt-1 pb-3">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--pt-ink)] text-[12px] font-bold text-[var(--pt-ground)]"
          >
            TN
          </span>
          <div className="flex flex-col">
            <strong className="font-semibold">Tu negocio</strong>
            <span className="text-[12px] text-[#556277]">Empresa</span>
          </div>
        </div>
        <span className="px-2 py-1.5 text-[12px] text-[#556277]">Plataforma</span>
        {SIDEBAR_ITEMS.map((item) => (
          <span
            key={item}
            className={`rounded-lg p-2 ${item === 'Tickets' ? 'bg-[#E8EFFD] font-semibold' : ''}`}
          >
            {item}
          </span>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3.5 px-5 py-[18px]">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-xl font-bold tracking-[-0.01em]">Tickets</strong>
          <span className="inline-flex h-9 items-center rounded-[10px] bg-[var(--pt-app-blue)] px-3.5 font-semibold text-white">
            + Nuevo ticket
          </span>
        </div>
        <div className="flex gap-[22px] border-b border-[#E2E8F0]">
          {TABS.map((tab) =>
            tab.dot ? (
              <span key={tab.label} className="flex items-center gap-1.5 pb-2 text-[#334155]">
                <Dot tone={tab.dot} />
                {tab.label}
              </span>
            ) : (
              <span
                key={tab.label}
                className="border-b-2 border-[var(--pt-app-blue)] pb-2 font-semibold"
              >
                {tab.label}
              </span>
            ),
          )}
        </div>
        <div className="flex flex-col">
          <div className={`${TABLE_GRID} border-b border-[#E2E8F0] py-2 text-[12px] text-[#556277]`}>
            <span>Folio</span>
            <span>Cliente</span>
            <span>Fecha</span>
            <span className="text-right">Total</span>
            <span className="text-right">Saldo</span>
            <span>Estado</span>
          </div>
          {ROWS.map((row, index) => (
            <div
              key={row.folio}
              data-testid="desktop-row"
              className={`${TABLE_GRID} py-[11px] ${index < ROWS.length - 1 ? 'border-b border-[#E2E8F0]' : ''}`}
            >
              <span className={`${FONT_MONO} text-[12px] text-[#556277]`}>{row.folio}</span>
              <strong className="truncate font-semibold">{row.client}</strong>
              <span className="text-[#334155]">{row.date}</span>
              <span className="text-right">{row.total}</span>
              {row.saldo === '$0.00' ? (
                <span className="text-right text-[#556277]">{row.saldo}</span>
              ) : (
                <strong className="text-right font-semibold">{row.saldo}</strong>
              )}
              <span className="flex items-center gap-1.5">
                <Dot tone={row.dot} />
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const PHONE_CARD = 'flex flex-col gap-[5px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 py-2.5';

/** Phone tickets list with the bottom dock. No status bar. */
const PhoneMock = () => (
  <div
    data-testid="phone-mock"
    className="w-[236px] shrink-0 rounded-[34px] bg-[var(--pt-ink)] p-2 shadow-[0_30px_60px_-30px_rgba(23,20,15,0.55)]"
  >
    <div className="flex flex-col overflow-hidden rounded-[27px] bg-[#F1F5F9] text-[12px] leading-[1.35] text-[#0B1220]">
      <div className="border-b border-[#E2E8F0] bg-white px-3.5 pt-4 pb-2.5">
        <strong className="text-[17px] font-bold tracking-[-0.01em]">Tickets</strong>
      </div>
      <div className="flex flex-col gap-2 p-2.5">
        <div className="flex gap-1.5">
          <span className="rounded-full bg-[#0B1220] px-3 py-1.5 font-semibold text-white">Todos</span>
          <span className="rounded-full border border-[#CBD5E1] bg-white px-3 py-1.5 text-[#334155]">
            Por cobrar · 26
          </span>
        </div>
        <div className={PHONE_CARD}>
          <div className="flex items-baseline justify-between gap-2">
            <strong className="text-sm font-semibold">Hotel Riviera Dorada</strong>
            <span className={`${FONT_MONO} text-[12px] text-[#556277]`}>R-0062</span>
          </div>
          <span className="flex items-center gap-1.5 text-[#556277]">
            <Dot tone="partial" />
            Pago parcial · mié 11 nov
          </span>
          <div aria-hidden className="h-[5px] overflow-hidden rounded-full bg-[#E2E8F0]">
            <div className="h-[5px] w-[49%] bg-[#F59E0B]" />
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[#556277]">Pagado $1,500.00</span>
            <strong className="font-semibold">Saldo $1,570.00</strong>
          </div>
        </div>
        <div className={PHONE_CARD}>
          <div className="flex items-baseline justify-between gap-2">
            <strong className="text-sm font-semibold">Gimnasio FitPro</strong>
            <span className={`${FONT_MONO} text-[12px] text-[#556277]`}>R-0060</span>
          </div>
          <span className="flex items-center gap-1.5 text-[#556277]">
            <Dot tone="paid" />
            Pagado · lun 9 nov
          </span>
          <div className="flex justify-between gap-2">
            <span className="text-[#556277]">Total</span>
            <strong className="font-semibold">$2,850.00</strong>
          </div>
        </div>
      </div>
      <div
        data-testid="phone-dock"
        className="mx-2.5 mb-3 flex items-center justify-around rounded-full border border-[#E2E8F0] bg-white px-1.5 py-2 text-[#556277]"
      >
        <span>Hoy</span>
        <span className="rounded-full bg-[#F1F5F9] px-2.5 py-[5px] font-semibold text-[#0B1220]">
          Tickets
        </span>
        <span
          aria-hidden
          className="flex size-[30px] items-center justify-center rounded-full border border-[#CBD5E1] text-[17px] text-[#0B1220]"
        >
          +
        </span>
        <span>Cobranza</span>
        <span>Más</span>
      </div>
    </div>
  </div>
);

/** ZIG-I39-4: "En la obra, el teléfono. En la oficina, la computadora." */
export const LandingTelefonoComputadora = () => (
  <section
    aria-labelledby="zz-equipos"
    className={`${SECTION_X} pb-[clamp(64px,8vw,112px)]`}
  >
    <div className="mx-auto max-w-[1180px] border-t-[1.5px] border-dashed border-[rgba(23,20,15,0.35)] pt-[clamp(48px,6vw,80px)]">
      <h2 id="zz-equipos" className={SECTION_TITLE}>
        En la obra, el teléfono.
        <br />
        En la oficina, la computadora.
      </h2>
      <p className={`mt-5 mb-[clamp(32px,4vw,56px)] max-w-[32em] ${SECTION_LEAD}`}>
        Lo que anotas en un lado aparece en el otro. Se instala desde el navegador en Android,
        iPhone o computadora.
      </p>
      <div className="flex min-w-0 flex-wrap items-end justify-center gap-6">
        <DesktopMock />
        <PhoneMock />
      </div>
    </div>
  </section>
);
