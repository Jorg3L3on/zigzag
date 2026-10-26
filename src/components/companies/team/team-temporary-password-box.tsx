'use client';

import { Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { buildNewMemberWhatsAppHref } from '@/lib/temporary-password-share';

export type CreatedTeamMember = { name: string; email: string; password: string };

/**
 * The temporary password of a person just added (ZIG-I32-2), shown once with
 * Copiar and WhatsApp. Shared by the desktop panel and the phone sheet.
 */
export const TeamTemporaryPasswordBox = ({
  created,
  companyName,
}: {
  created: CreatedTeamMember;
  companyName: string;
}) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(created.password);
      toast.success('Contraseña copiada');
    } catch {
      toast.error('No se pudo copiar. Escríbela tal como aparece.');
    }
  };

  return (
    <div className="space-y-3" data-testid="team-temporary-password-box">
      <p className="text-sm">
        <span className="font-semibold">{created.name}</span> ya está en tu equipo.
      </p>
      <div className="rounded-xl border bg-muted/40 p-3.5">
        <p className="text-sm font-medium">Contraseña temporal</p>
        <p
          className="mt-1 font-mono text-xl font-semibold tracking-wider"
          data-testid="temporary-password"
        >
          {created.password}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
            <Copy className="size-4" aria-hidden data-icon="inline-start" />
            Copiar
          </Button>
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
        </div>
        <p className="mt-2 text-caption text-muted-foreground">
          Se muestra una sola vez. Deberá cambiarla al entrar. No hay correo de invitación.
        </p>
      </div>
    </div>
  );
};

/**
 * The same box in the add form before saving (canvas EmpEquipo): nothing to
 * type, the password appears here once the person is added.
 */
export const TeamTemporaryPasswordNotice = () => (
  <div className="rounded-xl border bg-muted/40 p-3.5" data-testid="team-temporary-password-notice">
    <p className="text-sm font-medium">Contraseña temporal</p>
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <span className="font-mono text-base text-muted-foreground">[se genera al guardar]</span>
      <span className="ml-auto flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled>
          Copiar
        </Button>
        <Button type="button" variant="outline" size="sm" disabled>
          <MessageCircle className="size-4" aria-hidden data-icon="inline-start" />
          WhatsApp
        </Button>
      </span>
    </div>
    <p className="mt-2 text-caption text-muted-foreground">
      Se muestra una sola vez. Deberá cambiarla al entrar. No hay correo de invitación.
    </p>
  </div>
);
