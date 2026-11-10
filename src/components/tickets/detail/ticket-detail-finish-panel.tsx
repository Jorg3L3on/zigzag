'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileText, Loader2 } from 'lucide-react';
import { finishTicket } from '@/actions/tickets';
import {
  listClientServiceSchedulesForClient,
  type ClientServiceScheduleListItem,
} from '@/actions/client-service-schedules';
import { openFinishReminders } from '@/components/tickets/detail/ticket-finish-reminders';
import {
  TicketDetailRailLabel,
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { PaymentChoice, usePaymentChoice } from '@/components/tickets/review/payment-choice';
import { DesktopSwitch } from '@/components/desktop-switch';
import { MoneyFigure } from '@/components/documents/money-figure';
import { Button } from '@/components/ui/button';
import { FormattedCurrency } from '@/components/formatted-currency';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { fetchAndDeliverTicketInvoice } from '@/lib/ticket-invoice-download';
import { useInvoiceDeliveryMode } from '@/hooks/use-invoice-delivery-mode';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import { canFinishTicket } from '@/lib/tickets-rbac';

type ServiceLine = {
  serviceId: number;
  serviceName: string;
};

type TicketDetailFinishPanelProps = {
  ticketId: number | bigint;
  clientId: number | null;
  clientName: string | null;
  total: number | null;
  ticketDate: Date | null;
  /** Catalog lines, for service reminders. */
  serviceLines: ServiceLine[];
  /** All active lines (catalog + inline); finishing needs at least one. */
  lineCount?: number;
  downloadFileName: string;
  /**
   * Folio already assigned to this ticket (R-0012). The detail page passes it.
   * Without it the desktop note names the recibo and does not invent a number.
   */
  folio?: string | null;
};

/** Desktop note under Terminar y generar recibo (ZIG-I28-3). */
const finishReceiptNote = (folio: string | null | undefined) => {
  const label = folio?.trim();
  const receipt = label ? `el recibo ${label}` : 'el recibo';
  return `Se registra el pago, se crea ${receipt} y te preguntamos si quieres recordatorios de servicio para este cliente.`;
};

const FINISH_RETRY_GUIDANCE =
  'Revisa tu conexión e inténtalo de nuevo.';

export const TicketDetailFinishPanel = ({
  ticketId,
  clientId,
  clientName,
  total,
  ticketDate,
  serviceLines,
  lineCount,
  downloadFileName,
  folio = null,
}: TicketDetailFinishPanelProps) => {
  const router = useRouter();
  const { can } = usePermissions();
  const { selectedCompany } = useCompany();
  const canFinish = canFinishTicket(can);

  // No default: nothing is recorded as paid unless the user picks it (ZIG-I12 Q2).
  // The same question as the listo screen (ZIG-I13-4).
  const paymentChoice = usePaymentChoice(total ?? 0);
  const { payMode, chosenPaid, partialTooHigh, hasPayChoice } = paymentChoice;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const deliveryMode = useInvoiceDeliveryMode();

  if (!canFinish) {
    return null;
  }

  const ticketTotal = total ?? 0;
  const hasServices = (lineCount ?? serviceLines.length) > 0;

  const downloadServerTicketPdf = () =>
    fetchAndDeliverTicketInvoice({
      ticketId,
      companyId: selectedCompany?.id,
      downloadFileName:
        downloadFileName ||
        `${clientName ?? 'ticket'}_${String(ticketId)}.pdf`,
      mode: deliveryMode,
    });

  /** Saves the terminate and the payment, then delivers the recibo. The page is not refreshed here. */
  const executeFinishAndDownload = async (): Promise<boolean> => {
    const finalPaidAmount = chosenPaid;

    if (payMode === 'partial' && finalPaidAmount > ticketTotal) {
      toast.error('El monto pagado no puede ser mayor al total.');
      return false;
    }

    const result = await finishTicket(
      Number(ticketId),
      ticketTotal,
      finalPaidAmount,
      selectedCompany?.id ?? null,
    );

    if (!result.success) {
      const errorType = classifyClientError(null, undefined, result.errorType);
      const description = getErrorMessageByType(
        errorType,
        result.error || 'No se pudo finalizar el ticket',
      );
      toast.error(
        errorType === 'network' ? 'Sin conexión' : description,
        {
          description:
            errorType === 'network'
              ? `${description} ${FINISH_RETRY_GUIDANCE}`
              : undefined,
        },
      );
      return false;
    }

    const deliveryResult = await downloadServerTicketPdf();
    if (deliveryResult === 'shared') {
      toast.success('PDF compartido correctamente');
    } else if (deliveryResult === 'downloaded') {
      // Desktop names what happened, like every other Descargar (ZIG-I37-2).
      toast.success(
        deliveryMode === 'download' ? 'PDF descargado correctamente' : 'Recibo generado correctamente',
      );
    } else {
      toast.success('Ticket finalizado correctamente');
    }

    return true;
  };

  // The terminate and the payment are saved first (ZIG-I36-26). The Recordatorios
  // question comes after and only decides about reminders: it lives outside this panel
  // (saving swaps the panel out), and closing it any way means Omitir.
  const handleFinishClick = async () => {
    try {
      setIsSubmitting(true);

      let existingSchedules: ClientServiceScheduleListItem[] = [];
      const asksReminders = Boolean(clientId) && serviceLines.length > 0;
      if (asksReminders && clientId) {
        try {
          const schedulesResult = await listClientServiceSchedulesForClient(
            clientId,
            selectedCompany?.id ?? null,
          );
          existingSchedules = schedulesResult.data ?? [];
        } catch (error) {
          console.error('Error loading reminders before finish:', error);
        }
      }

      const finishedOk = await executeFinishAndDownload();
      if (!finishedOk) return;

      if (asksReminders && clientId) {
        openFinishReminders({
          ticketId: Number(ticketId),
          clientId,
          ticketDate: ticketDate ?? new Date(),
          serviceLines,
          existingSchedules,
        });
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error('Error preparing finish:', error);
      const errorType = classifyClientError(error);
      const description = getErrorMessageByType(
        errorType,
        'Ocurrió un error al finalizar',
      );
      toast.error(errorType === 'network' ? 'Sin conexión' : description, {
        description:
          errorType === 'network'
            ? `${description} ${FINISH_RETRY_GUIDANCE}`
            : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const paidExceedsTotal = partialTooHigh;
  const finishBlocked = isSubmitting || !hasServices || paidExceedsTotal || !hasPayChoice;

  const finishButtonLabel = isSubmitting ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Finalizando...
    </>
  ) : (
    <>
      <FileText className="h-4 w-4" aria-hidden />
      Terminar y generar recibo
    </>
  );

  // Phone card below lg, rail card from lg; no phone card first on a desktop reload (ZIG-28).
  // #finalizar stays on both so deep links and the desktop e2e still find the panel.
  const desktopPanel = (
    <div id="finalizar" className="min-w-0">
      <TicketDetailSectionCard
        id="terminar-ticket"
        tabIndex={-1}
        aria-labelledby="ticket-finish-heading"
        className="scroll-mt-24 border-primary/30 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <TicketDetailRailLabel id="ticket-finish-heading">Terminar ticket</TicketDetailRailLabel>

        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">Total del ticket</span>
          <MoneyFigure
            amount={ticketTotal}
            size="lg"
            className="shrink-0 whitespace-nowrap text-[22px] font-bold tracking-tight [overflow-wrap:normal]"
          />
        </div>

        <PaymentChoice
          choice={paymentChoice}
          idPrefix="detail"
          variant="options"
          total={ticketTotal}
          className="mt-4"
        />

        <Button
          type="button"
          id="terminar-ticket-button"
          onClick={() => void handleFinishClick()}
          disabled={finishBlocked}
          className="mt-4 h-11 w-full gap-2 text-[15px] md:h-11"
        >
          {finishButtonLabel}
        </Button>

        <p className="mt-3 text-caption leading-relaxed text-muted-foreground">
          {finishReceiptNote(folio)}
        </p>

        {!hasServices ? (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            Agrega al menos un servicio para poder finalizar.{' '}
            <Link
              href={`/tickets/${Number(ticketId)}/edit`}
              className="font-medium underline underline-offset-4"
            >
              Ir a servicios
            </Link>
          </p>
        ) : null}
      </TicketDetailSectionCard>
    </div>
  );

  const phonePanel = (
    <TicketDetailSectionCard
      id="finalizar"
      aria-labelledby="ticket-finish-heading"
    >
      <TicketDetailSectionHeading
        id="ticket-finish-heading"
        title="Terminar ticket"
        description="Registra el pago inicial y genera el recibo"
      />

      <div className="space-y-4">
        <p className="text-sm font-medium tabular-nums text-foreground">
          Total: <FormattedCurrency amount={total} />
        </p>

        <PaymentChoice choice={paymentChoice} idPrefix="detail" />

        <Button
          type="button"
          onClick={() => void handleFinishClick()}
          disabled={isSubmitting || !hasServices || paidExceedsTotal || !hasPayChoice}
          className="h-11 w-full gap-2 sm:w-auto"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Finalizando...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" aria-hidden />
              Terminar y generar recibo
            </>
          )}
        </Button>

        {!hasServices ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Agrega al menos un servicio para poder finalizar.{' '}
            <Link
              href={`/tickets/${Number(ticketId)}/edit`}
              className="font-medium underline underline-offset-4"
            >
              Ir a servicios
            </Link>
          </p>
        ) : null}
      </div>
    </TicketDetailSectionCard>
  );

  return (
    <>
      <DesktopSwitch phone={phonePanel} desktop={desktopPanel} />
    </>
  );
};
