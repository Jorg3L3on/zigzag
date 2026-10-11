'use client';

import * as React from 'react';
import { signOut } from 'next-auth/react';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';

import { signOutEverywhere } from '@/actions/users';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

/** Mi cuenta: close the session on every device, this one included (ZIG-I17-9). */
export const SignOutEverywhereButton = () => {
  const [pending, setPending] = React.useState(false);

  const confirm = async (event: React.MouseEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      const result = await signOutEverywhere();
      if (!result.success) {
        toast.error(result.error ?? 'No se pudo cerrar las sesiones. Intenta de nuevo.');
        setPending(false);
        return;
      }
      await signOut({ callbackUrl: '/login' });
    } catch {
      toast.error('No se pudo cerrar las sesiones. Intenta de nuevo.');
      setPending(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          data-testid="sign-out-everywhere"
        >
          <LogOut className="size-4" aria-hidden />
          Cerrar sesión en todos mis dispositivos
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cerrar sesión en todos tus dispositivos?</AlertDialogTitle>
          <AlertDialogDescription>
            Se cerrará tu sesión aquí y en cualquier teléfono o computadora donde
            hayas elegido mantenerla abierta. Tendrás que volver a entrar con tu
            correo y contraseña.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={pending}>
            {pending ? 'Cerrando…' : 'Cerrar todas las sesiones'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
