'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Image from 'next/image';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TripledMotionDiv, tripledFadeInUp } from '@/components/tripled';

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      router.push('/dashboard');
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
                src="/logo.png"
                alt="Logo de ZigZag"
                width={80}
                height={80}
                className="size-20"
              />
            </div>
            <span className="sr-only">zigzag</span>
          </a>
          <CardTitle>Bienvenido a zigzag</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
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
            {error && <div className="text-sm text-red-500">{error}</div>}
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
    </div>
  );
}
