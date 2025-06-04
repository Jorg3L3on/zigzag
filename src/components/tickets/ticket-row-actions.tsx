'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Eye, Pencil, FileDown, FileX } from 'lucide-react';
import Link from 'next/link';
import { DeleteTicketButton } from '@/components/delete-ticket-button';

interface Ticket {
  id: bigint;
  document: string | null;
}

interface TicketRowActionsProps {
  ticket: Ticket;
  onDelete?: (id: number) => void;
}

export function TicketDownloadButton({
  document,
}: {
  document: string | null;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => {
        if (document) {
          window.open(document, '_blank');
        }
      }}
      disabled={!document}
    >
      {document ? (
        <FileDown className="h-4 w-4" />
      ) : (
        <FileX className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}

export function TicketRowActions({ ticket, onDelete }: TicketRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <Link href={`/dashboard/tickets/${ticket.id}`}>
          <DropdownMenuItem>
            <Eye className="mr-2 h-4 w-4" />
            Ver detalles
          </DropdownMenuItem>
        </Link>
        <Link href={`/dashboard/tickets/${ticket.id}/edit`}>
          <DropdownMenuItem>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
        </Link>
        <DeleteTicketButton id={Number(ticket.id)} onDelete={onDelete} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
