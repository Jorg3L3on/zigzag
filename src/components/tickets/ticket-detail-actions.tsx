'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import {
  canEditTicket,
} from '@/lib/tickets-rbac';
type TicketDetailActionsProps = {
  ticketId: number | bigint;
  finished: boolean;
};

export const TicketDetailActions = ({
  ticketId,
  finished,
}: TicketDetailActionsProps) => {
  const { can } = usePermissions();
  const canEdit = canEditTicket(can);
  const id = Number(ticketId);

  if (finished) {
    return null;
  }

  if (!canEdit) {
    return null;
  }

  return (
    <div className="pt-2">
      <Link href={`/dashboard/tickets/${id}/edit`}>
        <Button className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-base font-semibold shadow-md transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-lg">
          Editar Ticket
        </Button>
      </Link>
    </div>
  );
};
