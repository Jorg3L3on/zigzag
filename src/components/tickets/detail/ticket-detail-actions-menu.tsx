'use client';

import * as React from 'react';
import Link from 'next/link';
import { Copy, Download, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { duplicateTicket } from '@/actions/tickets';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeleteTicketSheet } from '@/components/tickets/delete-ticket-sheet';
import { useReceiptShare } from '@/components/tickets/use-receipt-share';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { isTicketFullyPaid } from '@/lib/ticket-payment-status';
import {
  buildTicketComposerDraftKey,
  writeTicketComposerDraft,
} from '@/lib/ticket-composer-draft';
import {
  canAssignTicketServices,
  canDownloadTicketInvoice,
  canWriteTickets,
} from '@/lib/tickets-rbac';
import { cn } from '@/lib/utils';

type TicketDetailActionsMenuProps = {
  ticketId: number;
  /** Company folio shown in share titles and messages. */
  folio?: string | null;
  clientName: string | null;
  clientTel: string | null;
  total: number | null;
  paid: number | null;
  paymentsCount: number;
  downloadFileName: string;
  /**
   * Header on desktop (ZIG-I24-3): from 1024px Editar servicios and Duplicar
   * are buttons next to ⋯, which keeps Descargar PDF and Eliminar.
   */
  inlineFromLg?: boolean;
  className?: string;
};

/**
 * ⋯ menu of the ticket detail (ZIG-I13-4): Editar servicios, Descargar PDF,
 * Duplicar ticket, Eliminar ticket. Lives in the app bar on mobile and in the
 * header actions on desktop, where `inlineFromLg` brings the first ones out.
 */
export const TicketDetailActionsMenu = ({
  ticketId,
  folio = null,
  clientName,
  clientTel,
  total,
  paid,
  paymentsCount,
  downloadFileName,
  inlineFromLg = false,
  className,
}: TicketDetailActionsMenuProps) => {
  const { can } = usePermissions();
  const { selectedCompany } = useCompany();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const { download } = useReceiptShare({
    ticketId: String(ticketId),
    folio,
    downloadFileName,
    clientName,
    clientTel,
    total: total ?? 0,
  });

  /** Duplicar: a draft in the ticket composer, saved only on Guardar (ZIG-I13-6). */
  const handleDuplicate = async () => {
    const companyId = selectedCompany?.id ?? null;
    try {
      const result = await duplicateTicket(ticketId, companyId);
      if (!result.success) {
        toast.error(result.error ?? 'No se pudo duplicar el ticket');
        return;
      }
      const draft = result.data;
      if (companyId) {
        writeTicketComposerDraft(buildTicketComposerDraftKey(companyId), {
          client_id: draft.client.id > 0 ? draft.client.id : undefined,
          client_label: draft.client.label,
          ticket_date: draft.ticketDate,
          work_notes: draft.notes,
          lines: draft.lines,
        });
      }
      toast.success('Borrador listo: revísalo y guarda');
      router.push('/tickets/create');
    } catch {
      toast.error('No se pudo duplicar el ticket');
    }
  };

  const saldado = isTicketFullyPaid(total, paid);
  const canEditServices = canAssignTicketServices(can) && !saldado;
  const canPdf = canDownloadTicketInvoice(can);
  const canWrite = canWriteTickets(can);

  if (!canEditServices && !canPdf && !canWrite) return null;

  // Items shown as buttons from lg leave the menu there.
  const inlineItemClass = inlineFromLg ? 'lg:hidden' : undefined;

  return (
    <>
      {inlineFromLg && (canEditServices || canWrite) ? (
        <div className="hidden items-center gap-2 lg:flex" data-testid="ticket-detail-inline-actions">
          {canEditServices ? (
            <Button asChild variant="outline" className="h-10 gap-2 rounded-xl">
              <Link href={`/tickets/${ticketId}/edit`}>
                <Pencil className="h-4 w-4" aria-hidden />
                Editar servicios
              </Link>
            </Button>
          ) : null}
          {canWrite ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 rounded-xl"
              onClick={() => void handleDuplicate()}
            >
              <Copy className="h-4 w-4" aria-hidden />
              Duplicar
            </Button>
          ) : null}
        </div>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={className ?? 'h-11 w-11 shrink-0'}
            aria-label="Más acciones del ticket"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {canEditServices ? (
            <DropdownMenuItem asChild className={cn('min-h-11', inlineItemClass)}>
              <Link href={`/tickets/${ticketId}/edit`}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden />
                Editar servicios
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canPdf ? (
            <DropdownMenuItem className="min-h-11" onSelect={() => void download()}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Descargar PDF
            </DropdownMenuItem>
          ) : null}
          {canWrite ? (
            <DropdownMenuItem
              className={cn('min-h-11', inlineItemClass)}
              onSelect={() => void handleDuplicate()}
            >
              <Copy className="mr-2 h-4 w-4" aria-hidden />
              Duplicar ticket
            </DropdownMenuItem>
          ) : null}
          {canWrite ? (
            <>
              <DropdownMenuSeparator className={canPdf ? undefined : inlineItemClass} />
              <DropdownMenuItem
                className="min-h-11 text-destructive focus:text-destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Eliminar ticket
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {canWrite ? (
        <DeleteTicketSheet
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          ticketId={ticketId}
          folio={folio}
          clientName={clientName}
          total={total}
          paymentsCount={paymentsCount}
          paymentsTotal={paid ?? 0}
          companyId={selectedCompany?.id ?? null}
        />
      ) : null}
    </>
  );
};
