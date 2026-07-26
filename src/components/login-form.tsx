'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, signIn } from 'next-auth/react';
import Image from 'next/image';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

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
              <div className="grid gap-2">
                <Label
                  htmlFor="email"
                  className="text-[color:var(--login-ink)]"
                >
                  Correo electrónico
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="m@ejemplo.com"
                  className="h-11 border-[color:var(--login-line-strong)] bg-[color:var(--login-field-bg)] text-[color:var(--login-ink)]"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="password"
                  className="text-[color:var(--login-ink)]"
                >
                  Contraseña
                </Label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  className="h-11 border-[color:var(--login-line-strong)] bg-[color:var(--login-field-bg)] text-[color:var(--login-ink)]"
                  required
                />
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
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
