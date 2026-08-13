'use client';

import Link from 'next/link';
import {
  MoreHorizontal,
  Pencil,
  Receipt,
  User,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PDFDownloadButton } from '@/components/pdf-download-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TripledMobileStickyActionBar } from '@/components/tripled';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import {
  canAssignTicketServices,
  canCollectTicketPayment,
  canDownloadTicketInvoice,
  canEditTicket,
  canFinishTicket,
} from '@/lib/tickets-rbac';
import {
  getTicketBalanceDue,
  isTicketFullyPaid,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

type TicketDetailPrimaryActionsProps = {
  ticketId: number | bigint;
  clientId: number | null;
  finished: boolean;
  total: number | null;
  paid: number | null;
  downloadFileName: string;
  /** desktop = header cluster; mobile-sticky = bottom bar; both = fragment */
  placement?: 'desktop' | 'mobile-sticky' | 'both';
  className?: string;
};

export const TicketDetailPrimaryActions = ({
  ticketId,
  clientId,
  finished,
  total,
  paid,
  downloadFileName,
  placement = 'both',
  className,
}: TicketDetailPrimaryActionsProps) => {
  const { can } = usePermissions();
  const { selectedCompany } = useCompany();
  const id = Number(ticketId);
  const balanceDue = getTicketBalanceDue(total, paid);
  const saldado = isTicketFullyPaid(total, paid);

  const canFinish = canFinishTicket(can) && !finished;
  const canEdit = canEditTicket(can) && !saldado;
  const canServices = canAssignTicketServices(can) && !saldado;
  const canCollect =
    canCollectTicketPayment(can) && finished && balanceDue > 0;
  const canInvoice = canDownloadTicketInvoice(can) && finished;

  const hasSecondary = canEdit || canServices || Boolean(clientId);

  if (!canFinish && !canCollect && !canInvoice && !hasSecondary) {
    return null;
  }

  const primaryButton = (() => {
    if (canFinish) {
      return (
        <Button asChild className="h-10 w-full gap-2 md:w-auto">
          <a href="#finalizar" aria-label="Finalizar ticket">
            Finalizar
          </a>
        </Button>
      );
    }
    if (canCollect) {
      return (
        <Button asChild className="h-10 w-full gap-2 md:w-auto">
          <a href="#cobranza" aria-label="Registrar pago en cobranza">
            <Wallet className="h-4 w-4" aria-hidden />
            Registrar pago
          </a>
        </Button>
      );
    }
    if (canInvoice) {
      return (
        <PDFDownloadButton
          ticketId={ticketId}
          downloadFileName={downloadFileName}
          companyId={selectedCompany?.id}
          label="Generar recibo"
          variant="default"
          className="h-10 w-full md:w-auto"
        />
      );
    }
    return null;
  })();

  const secondaryMenu = hasSecondary ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          aria-label="Más acciones del ticket"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit ? (
          <DropdownMenuItem asChild>
            <Link href={`/tickets/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              Editar datos
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canServices ? (
          <DropdownMenuItem asChild>
            <Link href={`/tickets/${id}/services`}>
              <Receipt className="mr-2 h-4 w-4" aria-hidden />
              Servicios
            </Link>
          </DropdownMenuItem>
        ) : null}
        {clientId ? (
          <DropdownMenuItem asChild>
            <Link href={`/clients/${clientId}/edit`}>
              <User className="mr-2 h-4 w-4" aria-hidden />
              Ver cliente
            </Link>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const desktopCluster =
    placement === 'desktop' || placement === 'both' ? (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        {primaryButton}
        {secondaryMenu}
      </div>
    ) : null;

  const mobileSticky =
    (placement === 'mobile-sticky' || placement === 'both') && primaryButton ? (
      <TripledMobileStickyActionBar innerClassName="max-w-6xl">
        <div className="flex w-full min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">{primaryButton}</div>
          {secondaryMenu}
        </div>
      </TripledMobileStickyActionBar>
    ) : null;

  if (placement === 'desktop') return desktopCluster;
  if (placement === 'mobile-sticky') return mobileSticky;

  return (
    <>
      {desktopCluster}
      {mobileSticky}
    </>
  );
};
