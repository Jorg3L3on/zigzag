'use client';

import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/use-permissions';
import { canDownloadTicketInvoice } from '@/lib/tickets-rbac';
import { PDFDownloadButton } from '@/components/pdf-download-button';

type TicketDetailHeaderActionsProps = {
  ticketId: number | bigint;
  downloadFileName: string;
  finished: boolean;
};

export const TicketDetailHeaderActions = ({
  ticketId,
  downloadFileName,
  finished,
}: TicketDetailHeaderActionsProps) => {
  const { can } = usePermissions();

  if (!finished) {
    return null;
  }

  return (
    <div className="flex w-full min-w-0 shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-auto">
      <Badge
        variant="secondary"
        className="w-fit shrink-0 border-transparent bg-emerald-100 px-3 py-1 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:text-emerald-100"
      >
        Finalizado
      </Badge>
      {canDownloadTicketInvoice(can) ? (
        <PDFDownloadButton
          ticketId={ticketId}
          downloadFileName={downloadFileName}
        />
      ) : null}
    </div>
  );
};
