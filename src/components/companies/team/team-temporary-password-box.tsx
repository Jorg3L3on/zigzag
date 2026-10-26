'use client';

import { Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { buildNewMemberWhatsAppHref } from '@/lib/temporary-password-share';

export type CreatedTeamMember = { name: string; email: string; password: string };

/**
 * "Contraseña temporal" in the Agregar persona form (ZIG-I32-2, canvas
 * EmpEquipo): empty with Copiar / WhatsApp disabled until the person is added,
 * then the server-made password, shown once. Shared by the desktop panel and
 * the phone sheet.
 */
export const TeamTemporaryPasswordBox = ({
  created,
  companyName,
}: {
  created: CreatedTeamMember | null;
  companyName: string;
}) => {
  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.password);
      toast.success('Contraseña copiada');
    } catch {
      toast.error('No se pudo copiar. Escríbela tal como aparece.');
    }
  };

  return (
    <div
      className="rounded-xl border bg-muted/40 p-3.5"
      data-testid="team-temporary-password-box"
      aria-live="polite"
    >
      <p className="text-sm font-medium">Contraseña temporal</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {created ? (
          <span
            className="font-mono text-xl font-semibold tracking-wider"
            data-testid="temporary-password"
          >
            {created.password}
          </span>
        ) : (
          <span className="font-mono text-base text-muted-foreground">[se genera al guardar]</span>
        )}
        <span className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!created}
            onClick={() => void handleCopy()}
          >
            <Copy className="size-4" aria-hidden data-icon="inline-start" />
            Copiar
          </Button>
          {created ? (
            <Button asChild variant="outline" size="sm">
              <a
                href={buildNewMemberWhatsAppHref({ ...created, companyName })}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" aria-hidden data-icon="inline-start" />
                WhatsApp
              </a>
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled>
              <MessageCircle className="size-4" aria-hidden data-icon="inline-start" />
              WhatsApp
            </Button>
          )}
        </span>
      </div>
      <p className="mt-2 text-caption text-muted-foreground">
        {created
          ? `${created.name} ya está en tu equipo. `
          : null}
        Se muestra una sola vez. Deberá cambiarla al entrar. No hay correo de invitación.
      </p>
    </div>
  );
};
