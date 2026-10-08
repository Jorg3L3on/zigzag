'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { deactivateTeamMember } from '@/actions/team';
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
import type { TeamMember } from '@/lib/team-members';
import { showTeamActionError } from './team-member-sheet';

type TeamDeactivateDialogProps = {
  member: TeamMember | null;
  onOpenChange: (open: boolean) => void;
  onDeactivated: () => void;
};

export const TeamDeactivateDialog = ({
  member,
  onOpenChange,
  onDeactivated,
}: TeamDeactivateDialogProps) => {
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    if (!member) {
      return;
    }
    setPending(true);
    const result = await deactivateTeamMember(member.id);
    setPending(false);
    if (!result.success) {
      showTeamActionError(result, 'No se pudo desactivar al usuario');
      return;
    }
    toast.success(`${member.name} ya no tiene acceso`);
    onOpenChange(false);
    onDeactivated();
  };

  return (
    <AlertDialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Desactivar a {member?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Perderá el acceso de inmediato y se cerrarán sus sesiones. Sus tickets
            y su historial se conservan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              // Keep the dialog open until the server answers.
              event.preventDefault();
              void confirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? 'Desactivando…' : 'Desactivar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
