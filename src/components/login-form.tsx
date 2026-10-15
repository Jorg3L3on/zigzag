'use client';

import { ErrorText } from '@/components/error-text';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, signIn } from 'next-auth/react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

import { cn } from '@/lib/utils';
import { ZigZagMark } from '@/components/brand/zigzag-mark';
import { LoginForgotPassword } from '@/components/login/login-forgot-password';
import { LoginTicketGuideStub } from '@/components/login/login-ticket-guide-stub';
import { getSafeAppRedirectPath } from '@/lib/login-redirect';
import { rememberBrowserTimeZone } from '@/lib/time-greeting';

export function LoginForm({
  className,
  callbackUrl,
  sessionExpired = false,
  supportWhatsapp,
  ...props
}: React.ComponentPropsWithoutRef<'div'> & {
  callbackUrl?: string;
  sessionExpired?: boolean;
  /** Support WhatsApp number for ¿Olvidaste tu contraseña? (hidden when unset). */
  supportWhatsapp?: string | null;
}) {
  const router = useRouter();
  const reduceMotion = usePrefersReducedMotion();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [isStamped, setIsStamped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stampTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsHydrated(true);
    // The dashboard greets in local time from the first server render.
    rememberBrowserTimeZone();
    return () => {
      if (stampTimeoutRef.current) {
        clearTimeout(stampTimeoutRef.current);
      }
    };
  }, []);

  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setIsStamped(false);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const result = await signIn('credentials', {
        email,
        password,
        remember: remember ? 'true' : 'false',
        redirect: false,
      });

      if (result?.error) {
        setError('Correo o contraseña incorrectos. Código: AU001');
        return;
      }

      if (!reduceMotion) {
        setIsStamped(true);
        if (stampTimeoutRef.current) {
          clearTimeout(stampTimeoutRef.current);
        }
        stampTimeoutRef.current = setTimeout(() => {
          setIsStamped(false);
        }, 1100);
      }

      const session = await getSession();
      const fallbackDestination = session?.user?.company_is_system
        ? '/operator-console'
        : '/dashboard';
      const destination =
        getSafeAppRedirectPath(callbackUrl) ?? fallbackDestination;
      router.push(destination);
      router.refresh();
    } catch (e) {
      console.error(e);
      setError('No se pudo iniciar sesión. Intenta de nuevo. Código: GN001');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn('w-full', className)} {...props}>
      <div className="login-ticket-shadow w-full">
        <div className="login-ticket" data-testid="login-ticket">
          <div className="login-ticket-section">
            <div className="mb-[22px] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ZigZagMark
                  size={36}
                  className="size-[30px] shrink-0 sm:size-9"
                />
                <span className="font-[family-name:var(--font-login-display)] text-[17px] font-bold tracking-[-0.01em] text-[color:var(--login-ink)]">
                  ZigZag
                </span>
              </div>
              <span
                className="rounded border border-[color:var(--login-line)] px-2.5 py-1 font-[family-name:var(--font-login-mono)] text-caption tracking-[0.05em] text-[color:var(--login-ink-faint)]"
                aria-hidden
              >
                N.º 000001
              </span>
            </div>

            <h1 className="mb-1.5 font-[family-name:var(--font-login-display)] text-[22px] font-semibold tracking-[-0.015em] text-[color:var(--login-ink)] sm:text-[25px]">
              Bienvenido a ZigZag
            </h1>
            <p className="mb-[26px] text-base leading-normal text-[color:var(--login-ink-muted)]">
              Ingresa tus datos para ver tus tickets de hoy.
            </p>

            {sessionExpired ? (
              <div
                role="alert"
                aria-live="polite"
                className="mb-5 rounded-lg border border-[color:var(--login-line)] bg-[color:var(--login-field-bg)] p-3 text-sm text-[color:var(--login-ink)]"
              >
                <p className="font-semibold">Sesión expirada</p>
                <p className="mt-1 text-caption leading-normal text-[color:var(--login-ink-muted)]">
                  Vuelve a iniciar sesión para continuar en ZigZag.
                </p>
              </div>
            ) : null}

            <form
              onSubmit={onSubmit}
              method="post"
              className="space-y-5"
              data-hydrated={isHydrated ? 'true' : 'false'}
            >
              <div className="field mb-5">
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-[color:var(--login-ink-muted)]"
                >
                  Correo electrónico
                </label>
                <div className="login-input-line">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="m@ejemplo.com"
                    required
                    className="w-full border-0 border-b-[1.5px] border-[color:var(--login-line-strong)] bg-[color:var(--login-field-bg)] px-0.5 py-2.5 text-base text-[color:var(--login-ink)] outline-none placeholder:text-[color:var(--login-ink-faint)] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="field mb-5">
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-[color:var(--login-ink-muted)]"
                >
                  Contraseña
                </label>
                <div className="login-input-line">
                  <div className="flex items-center">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      className="w-full flex-1 border-0 border-b-[1.5px] border-[color:var(--login-line-strong)] bg-[color:var(--login-field-bg)] px-0.5 py-2.5 text-base text-[color:var(--login-ink)] outline-none placeholder:text-[color:var(--login-ink-faint)] focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleTogglePassword}
                      className="mb-0.5 flex size-11 items-center justify-center text-[color:var(--login-ink-muted)] transition-colors hover:text-[color:var(--login-ink)] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--login-accent-blue)]"
                      aria-label={
                        showPassword
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña'
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="size-5" aria-hidden />
                      ) : (
                        <Eye className="size-5" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <label
                htmlFor="remember"
                className="-ml-3 flex min-h-11 cursor-pointer items-center gap-1 text-[14px] text-[color:var(--login-ink)]"
              >
                {/* 44px tap area; the native box is invisible and the drawn one tracks it. */}
                <span className="relative flex size-11 shrink-0 items-center justify-center">
                  <input
                    id="remember"
                    name="remember"
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="peer absolute inset-0 size-full cursor-pointer text-base opacity-0"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none flex size-5 items-center justify-center rounded border-2 border-[color:var(--login-ink-muted)] bg-[color:var(--login-field-bg)] peer-checked:border-[color:var(--login-accent-blue)] peer-checked:bg-[color:var(--login-accent-blue)] peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--login-accent-blue)] peer-focus-visible:ring-offset-2 peer-checked:[&>svg]:opacity-100"
                  >
                    <Check className="size-3.5 text-white opacity-0" strokeWidth={3} />
                  </span>
                </span>
                <span>
                  Mantener mi sesión en este dispositivo
                  <span className="block text-[12.5px] text-[color:var(--login-ink-muted)]">
                    Se queda abierta hasta 30 días. Úsalo solo en tu equipo.
                  </span>
                </span>
              </label>

              {error ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="text-sm text-destructive"
                >
                  <ErrorText message={error} />
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                data-stamped={isStamped ? 'true' : 'false'}
                className="login-stamp-btn mt-1.5 min-h-11 w-full rounded-lg px-0 py-3.5 font-[family-name:var(--font-login-display)] text-[15px] font-semibold tracking-[0.01em] transition-[transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--login-accent-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--login-ticket-a)] disabled:cursor-not-allowed disabled:opacity-80"
              >
                <span className="login-stamp-label transition-opacity duration-200">
                  {isLoading && !isStamped
                    ? 'Iniciando sesión...'
                    : 'Iniciar sesión'}
                </span>
                <span className="login-stamp-mark" aria-hidden>
                  ✓ &nbsp;VALIDADO
                </span>
              </button>

              <LoginForgotPassword
                supportWhatsapp={supportWhatsapp}
                getLogin={() =>
                  (document.getElementById('email') as HTMLInputElement | null)?.value ?? ''
                }
              />
            </form>
          </div>

          <LoginTicketGuideStub />
        </div>
      </div>
    </div>
  );
}
