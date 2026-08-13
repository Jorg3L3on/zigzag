'use client';

import { useState, type MouseEvent } from 'react';
import { deleteTicket } from '@/actions/tickets';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface DeleteTicketButtonProps {
  id: number;
  companyId?: number | null;
  /** Optimistic remove from the list when delete is confirmed. */
  onDelete?: (id: number) => void;
  /** Restore the row if the server delete fails after optimistic remove. */
  onDeleteFailed?: (id: number) => void;
}

export function DeleteTicketButton({
  id,
  companyId = null,
  onDelete,
  onDeleteFailed,
}: DeleteTicketButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleConfirmDelete = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isPending) return;

    setIsPending(true);
    onDelete?.(id);

    try {
      const result = await deleteTicket(id, companyId);
      if (result.success) {
        toast.success('Ticket eliminado correctamente');
        setOpen(false);
        return;
      }

      onDeleteFailed?.(id);
      const errorType = classifyClientError(null, undefined, result.errorType);
      toast.error(
        getErrorMessageByType(
          errorType,
          result.error || 'Error al eliminar el ticket',
        ),
      );
    } catch (error) {
      console.error(error);
      onDeleteFailed?.(id);
      const errorType = classifyClientError(error);
      toast.error(getErrorMessageByType(errorType, 'Error al eliminar el ticket'));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start p-2 text-red-600 hover:bg-destructive/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          onClick={(event) => {
            event.stopPropagation();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={`Eliminar ticket ${id}`}
        >
          <Trash2 className="h-4 w-4" data-icon="inline-start" />
          <span className="ml-2">Eliminar</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar ticket</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Seguro que quieres eliminar el ticket {id}? Esta acción lo enviará
            a la papelera y puedes restaurarlo después si es necesario.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleConfirmDelete}
          >
            {isPending ? 'Eliminando…' : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
