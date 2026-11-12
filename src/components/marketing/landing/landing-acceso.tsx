'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ACCESS_OFICIOS,
  submitAccessRequest,
  validateAccessRequest,
  type AccessOficio,
  type AccessRequestErrors,
  type AccessRequestValues,
} from '@/components/marketing/landing/access-request';
import { PRIVACY_PATH } from '@/lib/marketing-routes';

const MONO = 'font-[family-name:var(--font-marketing-mono)]';

const EMPTY: AccessRequestValues = {
  nombre: '',
  negocio: '',
  whatsapp: '',
  oficio: ACCESS_OFICIOS[0],
};

const STEPS = [
  'Te escribimos por WhatsApp para conocer tu negocio.',
  'Damos de alta tu empresa, con tu logo.',
  'Entras desde tu teléfono y haces tu primer ticket.',
] as const;

const LABEL = `${MONO} mt-3.5 text-sm font-medium tracking-[0.08em] text-[var(--pt-muted)] uppercase`;
const FIELD =
  'h-12 w-full rounded-none border-0 border-b-[1.5px] border-dashed border-[var(--pt-ink)] bg-transparent px-0.5 text-lg text-[var(--pt-ink)] aria-[invalid=true]:border-[var(--pt-accent)]';
const ERROR = 'mt-1 text-sm font-medium text-[var(--pt-accent)]';

type TextField = 'nombre' | 'negocio' | 'whatsapp';

/**
 * Landing "Pide tu acceso" band: receipt-shaped request form. Nothing is sent
 * or stored (see submitAccessRequest); the receipt just flips to RECIBIDO.
 */
export const LandingAcceso = () => {
  const [values, setValues] = useState<AccessRequestValues>(EMPTY);
  const [errors, setErrors] = useState<AccessRequestErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [focusTarget, setFocusTarget] = useState<'confirmation' | 'nombre' | null>(null);
  const confirmationRef = useRef<HTMLParagraphElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const whatsappRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusTarget === 'confirmation') confirmationRef.current?.focus();
    if (focusTarget === 'nombre') nombreRef.current?.focus();
    if (focusTarget) setFocusTarget(null);
  }, [focusTarget]);

  const setText = (field: TextField) => (event: { target: { value: string } }) => {
    const value = event.target.value;
    setValues((current) => ({ ...current, [field]: value }));
    if (field !== 'negocio' && errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validateAccessRequest(values);
    setErrors(nextErrors);
    if (nextErrors.nombre) {
      nombreRef.current?.focus();
      return;
    }
    if (nextErrors.whatsapp) {
      whatsappRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await submitAccessRequest(values);
      setSent(true);
      setFocusTarget('confirmation');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setValues(EMPTY);
    setErrors({});
    setSent(false);
    setFocusTarget('nombre');
  };

  return (
    <section
      id="acceso"
      aria-labelledby="acceso-titulo"
      className="zz-edge-y bg-[var(--pt-ink)] px-4 py-[clamp(78px,9vw,134px)] text-[var(--pt-ground)] sm:px-[clamp(16px,4vw,40px)]"
    >
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-[clamp(32px,6vw,96px)]">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-6">
          <h2
            id="acceso-titulo"
            className="font-[family-name:var(--font-marketing-display)] text-[clamp(44px,6.4vw,88px)] leading-[0.95] font-extrabold tracking-[-0.04em]"
          >
            Pide tu
            <br />
            acceso.
          </h2>
          <p className="max-w-[28em] text-[clamp(18px,1.5vw,20px)] text-[#D9D0C1]">
            Déjanos tus datos y te escribimos por WhatsApp. Nosotros damos de alta tu
            empresa y te entregamos tu usuario.
          </p>
          <ol className="mt-2 flex flex-col gap-3.5">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-baseline gap-3.5">
                <span
                  aria-hidden
                  className={`${MONO} text-sm font-semibold text-[var(--pt-orange-from)]`}
                >
                  {`0${index + 1}`}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex min-w-0 flex-[1_1_400px] justify-center">
          <div className="w-full max-w-[460px] drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)]">
            <div className="zz-edge-y-sm bg-[var(--pt-paper)] px-[clamp(22px,3vw,36px)] py-[clamp(34px,4vw,46px)] text-[var(--pt-ink)]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <strong className="text-xl font-bold tracking-[0.02em]">
                  SOLICITUD DE ACCESO
                </strong>
                <span className={`${MONO} text-sm text-[var(--pt-muted)]`}>Folio: nuevo</span>
              </div>
              <div className="mt-3.5 mb-1.5 border-t-2 border-[var(--pt-ink)]" />

              {sent ? (
                <div className="flex flex-col items-start gap-[18px] pt-7 pb-2">
                  <span
                    className={`${MONO} inline-block -rotate-6 rounded-lg border-[3px] border-[var(--pt-accent)] px-4 py-1.5 text-[22px] font-semibold tracking-[0.14em] text-[var(--pt-accent)]`}
                  >
                    RECIBIDO
                  </span>
                  <p
                    ref={confirmationRef}
                    tabIndex={-1}
                    role="status"
                    className="font-[family-name:var(--font-marketing-display)] text-[26px] leading-[1.15] font-bold tracking-[-0.02em] outline-none"
                  >
                    Gracias. Te escribimos pronto por WhatsApp.
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="min-h-11 cursor-pointer rounded-[10px] border-[1.5px] border-[var(--pt-ink)] bg-transparent px-4 text-[15px] font-semibold text-[var(--pt-ink)]"
                  >
                    Enviar otra solicitud
                  </button>
                </div>
              ) : (
                <form
                  noValidate
                  aria-label="Solicitud de acceso"
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-1"
                >
                  <label htmlFor="zz-nombre" className={LABEL}>
                    Tu nombre
                  </label>
                  <input
                    ref={nombreRef}
                    id="zz-nombre"
                    name="nombre"
                    type="text"
                    autoComplete="name"
                    required
                    value={values.nombre}
                    onChange={setText('nombre')}
                    aria-invalid={errors.nombre ? true : undefined}
                    aria-describedby={errors.nombre ? 'zz-nombre-error' : undefined}
                    className={FIELD}
                  />
                  {errors.nombre ? (
                    <p id="zz-nombre-error" className={ERROR}>
                      {errors.nombre}
                    </p>
                  ) : null}

                  <label htmlFor="zz-negocio" className={LABEL}>
                    Tu negocio
                  </label>
                  <input
                    id="zz-negocio"
                    name="negocio"
                    type="text"
                    autoComplete="organization"
                    value={values.negocio}
                    onChange={setText('negocio')}
                    className={FIELD}
                  />

                  <label htmlFor="zz-whatsapp" className={LABEL}>
                    WhatsApp
                  </label>
                  <input
                    ref={whatsappRef}
                    id="zz-whatsapp"
                    name="whatsapp"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="10 dígitos"
                    required
                    value={values.whatsapp}
                    onChange={setText('whatsapp')}
                    aria-invalid={errors.whatsapp ? true : undefined}
                    aria-describedby={errors.whatsapp ? 'zz-whatsapp-error' : undefined}
                    className={`${FIELD} placeholder:text-[var(--pt-muted)]`}
                  />
                  {errors.whatsapp ? (
                    <p id="zz-whatsapp-error" className={ERROR}>
                      {errors.whatsapp}
                    </p>
                  ) : null}

                  <label htmlFor="zz-oficio" className={LABEL}>
                    Tu oficio
                  </label>
                  <select
                    id="zz-oficio"
                    name="oficio"
                    value={values.oficio}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        oficio: event.target.value as AccessOficio,
                      }))
                    }
                    className={FIELD}
                  >
                    {ACCESS_OFICIOS.map((oficio) => (
                      <option key={oficio}>{oficio}</option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    aria-disabled={submitting || undefined}
                    className="zz-btn mt-[26px] min-h-14 cursor-pointer rounded-[14px] border-0 bg-[linear-gradient(135deg,var(--pt-orange-from),var(--pt-button-to))] text-lg font-bold text-[var(--pt-ink)]"
                  >
                    Pedir acceso
                  </button>
                  <p className="mt-3 text-sm text-[var(--pt-muted)]">
                    Al enviar aceptas el{' '}
                    <Link
                      href={PRIVACY_PATH}
                      className="inline-flex min-h-11 items-center text-[var(--pt-ink)] underline underline-offset-4 hover:text-[var(--pt-accent)]"
                    >
                      Aviso de privacidad
                    </Link>
                    .
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
