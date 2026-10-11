'use client';

import { useState, type MouseEvent } from 'react';
import { Trash2 } from 'lucide-react';

import { DeleteTicketSheet } from '@/components/tickets/delete-ticket-sheet';
import { Button } from '@/components/ui/button';

interface DeleteTicketButtonProps {
  id: number;
  companyId?: number | null;
  /** What the sheet names: the client, the total and what was paid (ZIG-I13-6). */
  clientName?: string | null;
  total?: number | null;
  paid?: number | null;
  /** Optimistic remove from the list when delete is confirmed. */
  onDelete?: (id: number) => void;
  /** Restore the row if the server delete fails after optimistic remove. */
  onDeleteFailed?: (id: number) => void;
}

/**
 * Eliminar in the list row menu. It is a plain button, not a menu item, so the
 * menu stays mounted while the sheet is open; the sheet is the same one the
 * ticket detail uses and stays on the list after deleting.
 */
export function DeleteTicketButton({
  id,
  companyId = null,
  clientName = null,
  total = null,
  paid = null,
  onDelete,
  onDeleteFailed,
}: DeleteTicketButtonProps) {
  const [open, setOpen] = useState(false);

  const stop = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-start p-2 text-red-600 hover:bg-destructive/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        onClick={(event) => {
          stop(event);
          setOpen(true);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label={`Eliminar ticket ${id}`}
      >
        <Trash2 className="h-4 w-4" data-icon="inline-start" />
        <span className="ml-2">Eliminar</span>
      </Button>
      <DeleteTicketSheet
        open={open}
        onOpenChange={setOpen}
        ticketId={id}
        clientName={clientName}
        total={total}
        paymentsTotal={paid ?? 0}
        companyId={companyId}
        afterDeleteHref={null}
        onDeleteStart={onDelete}
        onDeleteFailed={onDeleteFailed}
      />
    </>
  );
}
