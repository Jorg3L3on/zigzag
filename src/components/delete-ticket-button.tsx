'use client';

import { Button } from '@/components/ui/button';
import { deleteTicket } from '@/actions/tickets';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';

interface DeleteTicketButtonProps {
  id: number;
  onDelete?: (id: number) => void;
}

export function DeleteTicketButton({ id, onDelete }: DeleteTicketButtonProps) {
  const router = useRouter();

  async function handleDelete() {
    try {
      // Optimistically remove the ticket from the UI
      if (onDelete) {
        onDelete(id);
      }

      const result = await deleteTicket(id);
      if (result.success) {
        toast.success('Ticket eliminado correctamente');
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'Error al eliminar el ticket',
          ),
        );
        // If there's an error, refresh the page to restore the correct state
        router.refresh();
      }
    } catch (e) {
      console.error(e);
      const errorType = classifyClientError(e);
      toast.error(getErrorMessageByType(errorType, 'Error al eliminar el ticket'));
      // If there's an error, refresh the page to restore the correct state
      router.refresh();
    }
  }

  return (
    <Button
      variant="ghost"
      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 p-2"
      onClick={handleDelete}
    >
      <Trash2 className="h-4 w-4" />
      <span className="ml-2">Eliminar</span>
    </Button>
  );
}
