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
import { deleteRole } from '@/actions/roles';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Role } from './columns';

interface DeleteRoleDialogProps {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteRoleDialog({
  role,
  open,
  onOpenChange,
}: DeleteRoleDialogProps) {
  const router = useRouter();

  const handleDelete = async () => {
    try {
      await deleteRole(role.id);
      toast.success('Rol eliminado correctamente');
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error('Error al eliminar el rol');
      console.error('Error al eliminar el rol:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar Rol</DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que deseas eliminar el rol{' '}
            <span className="font-semibold">{role.name}</span>? Esta acción no
            se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700"
            variant="destructive"
            onClick={handleDelete}
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
