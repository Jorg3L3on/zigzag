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
import { Company } from '@/generated/prisma/client';
import { toast } from 'sonner';

interface DeleteCompanyDialogProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteCompanyDialog({
  company,
  open,
  onOpenChange,
}: DeleteCompanyDialogProps) {
  const router = useRouter();

  async function onDelete() {
    const result = await deleteCompany(company.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Empresa eliminada correctamente');
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar Empresa</DialogTitle>
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
