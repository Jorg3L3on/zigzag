'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, signIn } from 'next-auth/react';
import Image from 'next/image';
import { BookOpen } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TripledMotionDiv, tripledFadeInUp } from '@/components/tripled';
import {
  openOnboardingGuide,
  PUBLIC_ONBOARDING_GUIDE_LINKS,
} from '@/lib/onboarding-guides';

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
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <TripledMotionDiv variants={tripledFadeInUp} initial="hidden" animate="visible">
        <Card className="border-border/60 shadow-md">
        <CardHeader className="items-center text-center">
          <a href="#" className="flex flex-col items-center gap-2 font-medium">
            <div className="flex h-20 w-20 items-center justify-center rounded-md">
              <Image
                src="/logo.png?v=provided-icon"
                alt="Logo de ZigZag"
                width={80}
                height={80}
                className="size-20 object-contain"
                unoptimized
              />
            </div>
            <span className="sr-only">zigzag</span>
          </a>
          <CardTitle>Bienvenido a zigzag</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onSubmit}
            method="post"
            className="space-y-5"
            data-hydrated={isHydrated ? 'true' : 'false'}
          >
            <div className="grid gap-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="m@ejemplo.com"
                className="h-11"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                className="h-11"
                required
              />
            </div>
            {error ? (
              <div
                role="alert"
                aria-live="assertive"
                className="text-sm text-red-500"
              >
                {error}
              </div>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              disabled={isLoading}
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>
        </CardContent>
        </Card>
      </TripledMotionDiv>
      <nav
        className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm"
        aria-label="Guías de inicio"
      >
        <p className="mb-3 text-center text-sm font-medium text-muted-foreground">
          ¿Primera vez en ZigZag? Elige tu guía
        </p>
        <ul className="grid gap-2">
          {PUBLIC_ONBOARDING_GUIDE_LINKS.map((guide) => (
            <li key={guide.href}>
              <button
                type="button"
                onClick={() => openOnboardingGuide(guide.href)}
                className="flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-primary/20 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BookOpen
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    {guide.label}
                  </span>
                  {guide.audienceLabel ? (
                    <span className="mt-0.5 block text-xs font-medium text-primary">
                      {guide.audienceLabel}
                    </span>
                  ) : null}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {guide.description}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
