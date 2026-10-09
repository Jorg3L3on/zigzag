'use client';

import Link from 'next/link';
import { ClipboardList, Ticket } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import { canWriteTickets } from '@/lib/tickets-rbac';

type ClientCreateShortcutsProps = {
  clientId: number;
};

/**
 * Nuevo ticket / Nuevo presupuesto for this client (ZIG-I5-5). Both composers
 * read ?clientId= and preselect the client.
 */
export const ClientCreateShortcuts = ({ clientId }: ClientCreateShortcutsProps) => {
  const { can, loading } = usePermissions();
  if (loading || !canWriteTickets(can)) return null;

  return (
    <section
      aria-label="Crear para este cliente"
      className="mb-4 grid grid-cols-2 gap-2"
      data-testid="client-create-shortcuts"
    >
      <Button asChild variant="outline" className="h-11 gap-2 rounded-xl">
        <Link href={`/tickets/create?clientId=${clientId}`}>
          <Ticket className="h-4 w-4" aria-hidden />
          Nuevo ticket
        </Link>
      </Button>
      <Button asChild variant="outline" className="h-11 gap-2 rounded-xl">
        <Link href={`/presupuestos/create?clientId=${clientId}`}>
          <ClipboardList className="h-4 w-4" aria-hidden />
          Nuevo presupuesto
        </Link>
      </Button>
    </section>
  );
};
