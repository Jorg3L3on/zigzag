'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { deleteUser } from '@/actions/users';
import { useRouter } from 'next/navigation';
import type { User } from '@/db/schema';
import { toast } from 'sonner';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';

interface DeleteUserDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
}: DeleteUserDialogProps) {
  const router = useRouter();

  async function onDelete() {
    const result = await deleteUser(user.id);
    if (!result.success) {
      const errorType = classifyClientError(null, undefined, result.errorType);
      toast.error(
        getErrorMessageByType(
          errorType,
          result.error || 'No se pudo eliminar el usuario',
        ),
      );
      return;
    }
    onOpenChange(false);
    router.refresh();
    toast.success('Usuario eliminado correctamente');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar Usuario</DialogTitle>
          <DialogDescription>
            Estás seguro de querer eliminar el usuario {user.name}? Esta acción
            no puede ser deshecha.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-600"
            variant="destructive"
            onClick={onDelete}
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
