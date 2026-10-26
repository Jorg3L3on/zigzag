'use client';

import { useState } from 'react';
import { Copy, KeyRound, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { buildTemporaryPasswordWhatsAppHref } from '@/lib/temporary-password-share';

type ResetResult = {
  success: boolean;
  data?: { temporaryPassword: string; userName: string };
  error?: string;
};

type TemporaryPasswordDialogProps = {
  /** The person who forgot their password; null keeps the dialog closed. */
  target: { name: string } | null;
  onReset: () => Promise<ResetResult>;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  /**
   * The action's name. Defaults to «Dar contraseña temporal»; Mi empresa on
   * desktop says «Restablecer contraseña», like its row action (ZIG-I32).
   */
  actionLabel?: string;
};

/**
 * Forgotten password without email (ZIG-I18-11): confirm, then show the temporary
 * password once with Copiar and a WhatsApp share. The person must replace it at
 * their next login.
 */
export const TemporaryPasswordDialog = ({
  target,
  onReset,
  onOpenChange,
  onDone,
  actionLabel = 'Dar contraseña temporal',
}: TemporaryPasswordDialogProps) => {
  const isReset = actionLabel !== 'Dar contraseña temporal';
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const hadPassword = password !== null;
      setPassword(null);
      setError(null);
      onOpenChange(false);
      if (hadPassword) onDone?.();
      return;
    }
    onOpenChange(true);
  };

  const handleConfirm = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await onReset();
      if (result.success && result.data) {
        setPassword(result.data.temporaryPassword);
      } else {
        setError(result.error ?? 'No se pudo dar la contraseña temporal. Intenta de nuevo.');
      }
    } catch {
      setError('No se pudo dar la contraseña temporal. Intenta de nuevo.');
    } finally {
      setPending(false);
    }
  };

  const handleCopy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      toast.success('Contraseña copiada');
    } catch {
      toast.error('No se pudo copiar. Escríbela tal como aparece.');
    }
  };

  return (
    <AlertDialog open={Boolean(target)} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        {password ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Contraseña temporal de {target?.name}</AlertDialogTitle>
              <AlertDialogDescription>
                Pásasela por WhatsApp o dísela en persona. Solo se muestra ahora. Al
                entrar tendrá que elegir una contraseña nueva.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <p
              className="rounded-xl border bg-muted/40 px-4 py-4 text-center font-mono text-3xl font-semibold tracking-wider"
              data-testid="temporary-password"
            >
              {password}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-12 text-base" onClick={handleCopy}>
                <Copy className="mr-2 size-5" aria-hidden />
                Copiar
              </Button>
              <Button asChild className="h-12 text-base">
                <a
                  href={buildTemporaryPasswordWhatsAppHref(target?.name ?? '', password)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="mr-2 size-5" aria-hidden />
                  Enviar por WhatsApp
                </a>
              </Button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-12 text-base">Listo</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isReset
                  ? `${actionLabel} de ${target?.name}`
                  : `¿Dar contraseña temporal a ${target?.name}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Se cierra su sesión ahora y la contraseña actual deja de servir. Al
                entrar con la temporal tendrá que elegir una nueva.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending} className="h-12 text-base">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                className="h-12 text-base"
                onClick={(event) => {
                  // Keep the dialog open until the server answers.
                  event.preventDefault();
                  void handleConfirm();
                }}
              >
                <KeyRound className="mr-2 size-5" aria-hidden />
                {pending ? 'Generando…' : actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};
