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
import { deleteCompany } from '@/actions/companies';
import { useRouter } from 'next/navigation';
import type { Company } from '@/db/schema';
import { toast } from 'sonner';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';

interface DeleteCompanyDialogProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteCompanyDialog({
  company,
  open,
  onOpenChange,
  onDeleted,
}: DeleteCompanyDialogProps) {
  const router = useRouter();

  async function onDelete() {
    const result = await deleteCompany(company.id);
    if (!result.success) {
      const errorType = classifyClientError(null, undefined, result.errorType);
      toast.error(
        getErrorMessageByType(
          errorType,
          result.error || 'No se pudo eliminar la empresa',
        ),
      );
      return;
    }
    toast.success('Empresa eliminada correctamente');
    onOpenChange(false);
    onDeleted?.();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar empresa</DialogTitle>
          <DialogDescription>
            Estás seguro de querer eliminar la empresa {company.name}? Esta
            acción no puede ser deshecha.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700"
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
