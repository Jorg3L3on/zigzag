type Pregunta = { question: string; answer: string };

export const LANDING_PREGUNTAS: readonly Pregunta[] = [
  {
    question: '¿Tengo que instalar algo?',
    answer:
      'No. ZigZag se abre en el navegador de tu teléfono o de tu computadora. Si quieres, lo instalas desde ahí como una app, sin pasar por la tienda de apps.',
  },
  {
    question: '¿Funciona sin internet?',
    answer:
      'Puedes crear tickets y presupuestos sin señal: se guardan en tu teléfono y se suben solos cuando vuelve. Para ver la cobranza o descargar un recibo sí necesitas conexión.',
  },
  {
    question: '¿El recibo es una factura?',
    answer:
      'No. ZigZag hace recibos y presupuestos en PDF con tu logo. No timbra facturas (CFDI): para eso sigues usando tu sistema de facturación.',
  },
  {
    question: '¿ZigZag cobra por mí?',
    answer:
      'No mueve tu dinero. Tú anotas cuánto te pagaron y ZigZag lleva la cuenta de lo que falta y te lo muestra en Cobranza.',
  },
  {
    question: '¿Sirve para mi oficio?',
    answer:
      'Si haces trabajos para clientes y cobras por servicio, sí: clima, plomería, electricidad, herrería, mantenimiento. Tú defines tus servicios y tus precios.',
  },
  {
    question: '¿Puedo usarlo con mi equipo?',
    answer:
      'Sí. Invitas a tu gente y decides qué puede ver y qué puede editar cada quien.',
  },
  {
    question: '¿Quién puede ver mis datos?',
    answer:
      'Solo tu empresa y las personas que tú invites. Cada pago y cada cambio queda registrado.',
  },
];

/**
 * Landing FAQ: native <details>/<summary>, so it opens with Enter/Space and
 * works without JavaScript. The first answer starts open.
 */
export const LandingPreguntas = () => (
  <section
    id="preguntas"
    aria-labelledby="preguntas-titulo"
    className="px-4 py-[clamp(64px,8vw,112px)] sm:px-[clamp(16px,4vw,40px)]"
  >
    <div className="mx-auto flex max-w-[1180px] flex-wrap items-start gap-[clamp(24px,5vw,72px)]">
      <div className="min-w-0 flex-[1_1_300px]">
        <h2
          id="preguntas-titulo"
          className="font-[family-name:var(--font-marketing-display)] text-[clamp(34px,4.6vw,62px)] leading-none font-extrabold tracking-[-0.035em]"
        >
          Preguntas de siempre.
        </h2>
        <p className="mt-5 max-w-[24em] text-[var(--pt-body)]">
          ¿Tienes otra? Pregúntanos cuando pidas tu acceso.
        </p>
      </div>
      <div className="min-w-0 flex-[2_1_480px] border-b border-[var(--pt-line-strong)]">
        {LANDING_PREGUNTAS.map((item, index) => (
          <details
            key={item.question}
            open={index === 0}
            className="group border-t border-[var(--pt-line-strong)]"
          >
            <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 py-1.5 text-[clamp(18px,1.5vw,20px)] font-semibold [&::-webkit-details-marker]:hidden">
              {item.question}
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden
                className="flex-none motion-safe:transition-transform group-open:rotate-45"
                fill="none"
                stroke="var(--pt-accent)"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </summary>
            <p className="mb-[22px] max-w-[40em] text-[var(--pt-body)]">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
);
