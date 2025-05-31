'use client';

import { Button } from '@/components/ui/button';
import { deleteTicket } from '@/actions/tickets';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface DeleteTicketButtonProps {
  id: number;
}

export function DeleteTicketButton({ id }: DeleteTicketButtonProps) {
  const router = useRouter();

  async function handleDelete() {
    try {
      const result = await deleteTicket(id);
      if (result.success) {
        toast.success('Ticket eliminado correctamente');
        router.refresh();
      } else {
        toast.error('Error al eliminar el ticket');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al eliminar el ticket');
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
