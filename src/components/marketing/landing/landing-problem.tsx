import {
  APP_CARD,
  FONT_MONO,
  SECTION_LEAD,
  SECTION_TITLE,
  SECTION_X,
} from './landing-styles';

const SCRAP_SHADOW = 'shadow-[0_10px_20px_-12px_rgba(23,20,15,0.4)]';
const HANDWRITING = { fontFamily: "'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive" };
const SHEET_CELL = 'px-2 py-[5px] border-[#B9C4BB]';

/** The three scraps a debt usually lives on: a notebook, a chat and a sheet. */
const Scraps = () => (
  <div className="flex flex-wrap justify-center gap-4" data-testid="problem-scraps">
    <p
      className={`m-0 w-[150px] -rotate-[4deg] bg-[repeating-linear-gradient(#FFF3B0_0_23px,#D9C56A_23px_24px)] px-3 pt-3.5 pb-[18px] text-base leading-6 text-[#1E3A8A] ${SCRAP_SHADOW}`}
      style={HANDWRITING}
    >
      Sra. Lupita
      <br />
      minisplit recámara
      <br />
      debe $1,200 ???
    </p>
    <div
      className={`max-w-[168px] self-start rotate-3 rounded-[14px_14px_2px_14px] bg-[#D7F5CE] px-3 pt-2.5 pb-2 text-[15px] leading-[1.35] text-[#111B14] ${SCRAP_SHADOW}`}
    >
      Luego le deposito lo que falta, joven.
      <div className="mt-1 text-right text-[12px] text-[#3F5245]">4:12 p. m.</div>
    </div>
    <div
      className={`grid w-[172px] -rotate-2 grid-cols-2 border border-[#B9C4BB] bg-white ${FONT_MONO} text-[12px] text-[var(--pt-ink)] ${SCRAP_SHADOW}`}
    >
      <span className={`${SHEET_CELL} border-r border-b bg-[#E4EFE6] font-semibold`}>CLIENTE</span>
      <span className={`${SHEET_CELL} border-b bg-[#E4EFE6] font-semibold`}>SALDO</span>
      <span className={`${SHEET_CELL} border-r border-b`}>Lupita</span>
      <span className={`${SHEET_CELL} border-b font-semibold text-[#B42318]`}>#¡REF!</span>
      <span className={`${SHEET_CELL} border-r`}>Hotel</span>
      <span className={SHEET_CELL}>¿pagó?</span>
    </div>
  </div>
);

/** ZIG-I39-3: "El trabajo ya lo hiciste. ¿Y el cobro?" with the scraps → ticket card. */
export const LandingProblem = () => (
  <section
    aria-labelledby="zz-problema"
    className={`${SECTION_X} py-[clamp(64px,8vw,112px)]`}
  >
    <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-[clamp(40px,6vw,88px)]">
      <div className="min-w-0 flex-[1_1_400px]">
        <h2 id="zz-problema" className={SECTION_TITLE}>
          El trabajo ya lo hiciste.
          <br />
          ¿Y el cobro?
        </h2>
        <p className={`mt-6 max-w-[34em] ${SECTION_LEAD}`}>
          La nota en la libreta. El “luego le deposito lo que falta” en WhatsApp. El Excel
          que nadie abre. Cada trabajo sin recibo es dinero que se te puede olvidar.
        </p>
      </div>

      <div className="flex min-w-0 flex-[1_1_400px] flex-col items-center gap-[18px]">
        <Scraps />
        <svg
          viewBox="0 0 40 56"
          width="40"
          height="56"
          aria-hidden
          fill="none"
          stroke="var(--pt-orange-to)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 4L28 14L12 24L28 34L20 46M12 40l8 8 9-7" />
        </svg>
        <div className="flex w-full max-w-[420px] flex-col gap-2">
          <span
            className={`${FONT_MONO} text-sm font-medium uppercase tracking-[0.08em] text-[var(--pt-muted)] md:text-[12px]`}
          >
            En ZigZag se ve así
          </span>
          <div
            className={`${APP_CARD} flex flex-col gap-2 px-[18px] py-4 text-[15px]`}
            data-testid="problem-ticket"
          >
            <div className="flex items-baseline justify-between gap-3">
              <strong className="text-[17px] font-semibold">Sra. Lupita</strong>
              <span className={`${FONT_MONO} text-sm text-[#556277] md:text-[13px]`}>R-0058</span>
            </div>
            <span className="text-[#334155]">Instalación de minisplit</span>
            <span className="flex items-center gap-2 text-sm text-[#556277]">
              <span aria-hidden className="size-2 rounded-full bg-[#F59E0B]" />
              Pago parcial · sáb 7 nov
            </span>
            <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-[#E2E8F0]">
              <div className="h-1.5 w-[60%] bg-[#F59E0B]" />
            </div>
            <div className="flex flex-wrap justify-between gap-3">
              <span className="text-[#556277]">Pagado $1,800.00</span>
              <strong className="font-semibold">Saldo $1,200.00</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);
