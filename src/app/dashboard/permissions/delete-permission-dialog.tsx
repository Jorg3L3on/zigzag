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
import { deletePermission } from '@/actions/permissions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Permission } from './columns';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';

interface DeletePermissionDialogProps {
  permission: Permission;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeletePermissionDialog({
  permission,
  open,
  onOpenChange,
}: DeletePermissionDialogProps) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deletePermission(permission.id);
    if (!result.success) {
      const errorType = classifyClientError(null, undefined, result.errorType);
      toast.error(
        getErrorMessageByType(
          errorType,
          result.error || 'Error al eliminar el permiso',
        ),
      );
      return;
    }

    toast.success('Permiso eliminado correctamente');
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar Permiso</DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que deseas eliminar el permiso{' '}
            <span className="font-semibold">{permission.name}</span>? Esta
            acción no se puede deshacer.
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
