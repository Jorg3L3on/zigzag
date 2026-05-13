'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Eye, Pencil, FileDown, Banknote } from 'lucide-react';
import Link from 'next/link';
import { DeleteTicketButton } from '@/components/delete-ticket-button';
import {
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';

interface Ticket {
  id: bigint;
  document: string | null;
  finished: boolean;
  total: number | null;
  paid: number | null;
}

interface TicketRowActionsProps {
  ticket: Ticket;
  onDelete?: (id: number) => void;
}

export function TicketRowActions({ ticket, onDelete }: TicketRowActionsProps) {
  const showCollectLink =
    ticket.finished &&
    getTicketPaymentStatus(ticket.total, ticket.paid) === 'partial';

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
        {showCollectLink && (
          <Link href={`/dashboard/tickets/${ticket.id}#cobranza`}>
            <DropdownMenuItem>
              <Banknote className="mr-2 h-4 w-4" />
              Cobrar saldo
            </DropdownMenuItem>
          </Link>
        )}
        {!ticket.finished && (
          <Link href={`/dashboard/tickets/${ticket.id}/edit`}>
            <DropdownMenuItem>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          </Link>
        )}
        {ticket.document ? (
          <DropdownMenuItem asChild>
            <a
              href={ticket.document}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Ver PDF
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <FileDown className="mr-2 h-4 w-4" />
            Ver PDF
          </DropdownMenuItem>
        )}
        <DeleteTicketButton id={Number(ticket.id)} onDelete={onDelete} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
