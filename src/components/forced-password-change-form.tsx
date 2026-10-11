'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';

import { completeForcedPasswordChange } from '@/actions/users';
import { ErrorText } from '@/components/error-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateNewPassword } from '@/lib/password-change';

type ForcedPasswordChangeFormProps = {
  homePath: string;
};

/**
 * Elegir contraseña nueva (ZIG-I18-11): the only screen reachable with a
 * temporary password. Big fields, one action, a way out.
 */
export const ForcedPasswordChangeForm = ({ homePath }: ForcedPasswordChangeFormProps) => {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = validateNewPassword(newPassword, confirmPassword);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await completeForcedPasswordChange({ newPassword, confirmPassword });
      if (!result.success) {
        setError(result.error ?? 'No se pudo guardar la contraseña. Intenta de nuevo.');
        return;
      }
      router.replace(homePath);
      router.refresh();
    } catch {
      setError('No se pudo guardar la contraseña. Intenta de nuevo.');
    } finally {
      setPending(false);
    }
  };

  const type = show ? 'text' : 'password';

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="forced-password-change">
      <div className="space-y-2">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <KeyRound className="size-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold">Elige tu contraseña nueva</h1>
        <p className="text-base text-muted-foreground">
          Entraste con una contraseña temporal. Elige una que recuerdes para seguir.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password" className="text-base">
          Contraseña nueva
        </Label>
        <Input
          id="new-password"
          type={type}
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="h-14 text-base"
          required
        />
        <p className="text-sm text-muted-foreground">Al menos 8 caracteres.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password" className="text-base">
          Repite la contraseña nueva
        </Label>
        <Input
          id="confirm-password"
          type={type}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="h-14 text-base"
          required
        />
      </div>

      <button
        type="button"
        onClick={() => setShow((value) => !value)}
        className="flex min-h-11 items-center gap-2 text-base font-medium underline underline-offset-4"
      >
        {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        {show ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
      </button>

      {error ? (
        <div role="alert" className="text-base text-destructive">
          <ErrorText message={error} />
        </div>
      ) : null}

      <div className="space-y-3">
        <Button type="submit" className="h-14 w-full text-lg" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar y entrar'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-12 w-full text-base"
          onClick={() => void signOut({ callbackUrl: '/login' })}
        >
          Salir
        </Button>
      </div>
    </form>
  );
};
