'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, Trash } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertModal } from '@/components/modals/alert-modal';
import { ClientColumn } from './columns';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';

interface CellActionProps {
  data: ClientColumn;
}

export default function CellAction({ data }: CellActionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const onDelete = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/clients/${data.id}`, {
        method: 'DELETE',
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) {
        const errorType = classifyClientError(
          null,
          response.status,
          payload?.errorType,
        );
        throw new Error(
          getErrorMessageByType(
            errorType,
            payload?.error || 'No se pudo eliminar el cliente',
          ),
        );
      }

      toast.success('Cliente eliminado correctamente.');
      router.refresh();
    } catch (e) {
      console.error('[CLIENT_FORM]', e);
      const errorType = classifyClientError(e);
      toast.error(getErrorMessageByType(errorType, 'Algo salió mal'));
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() =>
              router.push(`/dashboard/clients/${data.id}/edit`)
            }
          >
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowDeleteModal(true)}>
            <Trash className="mr-2 h-4 w-4" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={onDelete}
        loading={loading}
      />
    </>
  );
}
