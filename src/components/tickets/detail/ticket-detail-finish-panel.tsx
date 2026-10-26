'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileText, Loader2 } from 'lucide-react';
import { finishTicket } from '@/actions/tickets';
import {
  listClientServiceSchedulesForClient,
  upsertClientServiceSchedule,
  type ClientServiceScheduleListItem,
} from '@/actions/client-service-schedules';
import {
  TicketFinishSchedulesDialog,
  type TicketFinishScheduleLine,
} from '@/components/service-schedules/ticket-finish-schedules-dialog';
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
  const [schedulesDialogOpen, setSchedulesDialogOpen] = React.useState(false);
  const [existingSchedules, setExistingSchedules] = React.useState<
    ClientServiceScheduleListItem[]
  >([]);

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
    });

  const executeFinishAndDownload = async (): Promise<boolean> => {
    const finalPaidAmount = chosenPaid;

    if (payMode === 'partial' && finalPaidAmount > ticketTotal) {
      toast.error('El monto pagado no puede ser mayor al total. Código: TC009');
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
      toast.success('Recibo generado correctamente');
    } else {
      toast.success('Ticket finalizado correctamente');
    }

    router.refresh();
    return true;
  };

  const handleFinishClick = async () => {
    try {
      setIsSubmitting(true);

      if (!clientId || serviceLines.length === 0) {
        await executeFinishAndDownload();
        return;
      }

      const schedulesResult = await listClientServiceSchedulesForClient(
        clientId,
        selectedCompany?.id ?? null,
      );
      setExistingSchedules(schedulesResult.data ?? []);
      setSchedulesDialogOpen(true);
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

  const handleSchedulesSkip = async () => {
    try {
      setIsSubmitting(true);
      await executeFinishAndDownload();
      setSchedulesDialogOpen(false);
    } catch (error) {
      const errorType = classifyClientError(error);
      toast.error(getErrorMessageByType(errorType, 'Ocurrió un error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSchedulesConfirm = async (lines: TicketFinishScheduleLine[]) => {
    try {
      setIsSubmitting(true);
      const finishedOk = await executeFinishAndDownload();
      if (!finishedOk || !clientId) {
        return;
      }

      for (const line of lines.filter((item) => item.checked)) {
        const upsertResult = await upsertClientServiceSchedule({
          clientId,
          serviceId: line.serviceId,
          intervalValue: line.intervalValue,
          intervalUnit: line.intervalUnit,
          lastServiceAt: line.lastServiceAt,
          companyId: selectedCompany?.id ?? null,
        });
        if (!upsertResult.success) {
          toast.error(
            upsertResult.error ||
              'El ticket se finalizó pero no se pudo guardar un recordatorio',
          );
        }
      }

      setSchedulesDialogOpen(false);
    } catch (error) {
      console.error('Error saving schedules:', error);
      const errorType = classifyClientError(error);
      toast.error(getErrorMessageByType(errorType, 'Ocurrió un error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const paidExceedsTotal = partialTooHigh;
  const finishBlocked = isSubmitting || !hasServices || paidExceedsTotal || !hasPayChoice;

  const schedulesDialog = (
    <TicketFinishSchedulesDialog
      open={schedulesDialogOpen}
      onOpenChange={setSchedulesDialogOpen}
      ticketDate={ticketDate ?? new Date()}
      serviceLines={serviceLines}
      existingSchedules={existingSchedules}
      saving={isSubmitting}
      onConfirm={(lines) => void handleSchedulesConfirm(lines)}
      onSkip={() => void handleSchedulesSkip()}
    />
  );

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
      {schedulesDialog}
    </>
  );
};
