'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, signIn } from 'next-auth/react';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/lib/utils';

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isStamped, setIsStamped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stampTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsHydrated(true);
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
        redirect: false,
      });

      if (result?.error) {
        setError('Correo o contraseña incorrectos. Código: AU001');
        return;
      }

      setIsStamped(true);
      if (stampTimeoutRef.current) {
        clearTimeout(stampTimeoutRef.current);
      }
      stampTimeoutRef.current = setTimeout(() => {
        setIsStamped(false);
      }, 1100);

      const session = await getSession();
      const destination = session?.user?.company_is_system
        ? '/operator-console'
        : '/dashboard';
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
                <Image
                  src="/logo.png"
                  alt=""
                  width={36}
                  height={36}
                  className="size-[30px] object-contain sm:size-9"
                  unoptimized
                  priority
                />
                <span className="font-[family-name:var(--font-login-display)] text-[17px] font-bold tracking-[-0.01em] text-[color:var(--login-ink)]">
                  zigzag
                </span>
              </div>
              <span
                className="rounded border border-[color:var(--login-line)] px-2.5 py-1 font-[family-name:var(--font-login-mono)] text-[11px] tracking-[0.05em] text-[color:var(--login-ink-faint)]"
                aria-hidden
              >
                N.º 000001
              </span>
            </div>

            <h1 className="mb-1.5 font-[family-name:var(--font-login-display)] text-[22px] font-semibold tracking-[-0.015em] text-[color:var(--login-ink)] sm:text-[25px]">
              Bienvenido a ZigZag
            </h1>
            <p className="mb-[26px] text-[13.5px] leading-normal text-[color:var(--login-ink-muted)]">
              Ingresa tus datos para ver tus tickets de hoy.
            </p>

            <form
              onSubmit={onSubmit}
              method="post"
              className="space-y-5"
              data-hydrated={isHydrated ? 'true' : 'false'}
            >
              <div className="field mb-5">
                <label
                  htmlFor="email"
                  className="mb-2 block font-[family-name:var(--font-login-mono)] text-[10.5px] font-medium tracking-[0.09em] text-[color:var(--login-ink-faint)] uppercase"
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
                    className="w-full border-0 border-b-[1.5px] border-[color:var(--login-line-strong)] bg-[color:var(--login-field-bg)] px-0.5 py-2.5 text-[14.5px] text-[color:var(--login-ink)] outline-none placeholder:text-[color:var(--login-ink-faint)] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="field mb-5">
                <label
                  htmlFor="password"
                  className="mb-2 block font-[family-name:var(--font-login-mono)] text-[10.5px] font-medium tracking-[0.09em] text-[color:var(--login-ink-faint)] uppercase"
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
                      className="w-full flex-1 border-0 border-b-[1.5px] border-[color:var(--login-line-strong)] bg-[color:var(--login-field-bg)] px-0.5 py-2.5 text-[14.5px] text-[color:var(--login-ink)] outline-none placeholder:text-[color:var(--login-ink-faint)] focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleTogglePassword}
                      className="mb-0.5 p-1.5 text-[color:var(--login-ink-faint)] transition-colors hover:text-[color:var(--login-ink)] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--login-accent-blue)]"
                      aria-label={
                        showPassword
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña'
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="size-[17px]" aria-hidden />
                      ) : (
                        <Eye className="size-[17px]" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="text-sm text-destructive"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                data-stamped={isStamped ? 'true' : 'false'}
                className="login-stamp-btn mt-1.5 w-full rounded-lg px-0 py-3.5 font-[family-name:var(--font-login-display)] text-[15px] font-semibold tracking-[0.01em] transition-[transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--login-accent-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--login-ticket-a)] disabled:cursor-not-allowed disabled:opacity-80"
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
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
