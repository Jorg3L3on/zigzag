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
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { PaymentChoice, usePaymentChoice } from '@/components/tickets/review/payment-choice';
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

  return (
    <>
      <TicketDetailSectionCard
        id="finalizar"
        aria-labelledby="ticket-finish-heading"
      >
        <TicketDetailSectionHeading
          id="ticket-finish-heading"
          title="Finalizar ticket"
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
                Finalizar y generar recibo
              </>
            )}
          </Button>

          {!hasServices ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Agrega al menos un servicio para poder finalizar.{' '}
              <Link
                href={`/tickets/${Number(ticketId)}/services`}
                className="font-medium underline underline-offset-4"
              >
                Ir a servicios
              </Link>
            </p>
          ) : null}
        </div>
      </TicketDetailSectionCard>

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
    </>
  );
};
