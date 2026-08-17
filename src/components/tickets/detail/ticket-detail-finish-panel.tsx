'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Circle,
  CircleCheck,
  FileText,
  Loader2,
  Minus,
  Plus,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';

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
  serviceLines: ServiceLine[];
  downloadFileName: string;
};

const parsePaidInput = (value: string): number => {
  if (!value.trim()) return 0;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(parsed, 0);
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
  downloadFileName,
}: TicketDetailFinishPanelProps) => {
  const router = useRouter();
  const { can } = usePermissions();
  const { selectedCompany } = useCompany();
  const canFinish = canFinishTicket(can);

  const [isFullyPaid, setIsFullyPaid] = React.useState(true);
  const [paidAmountInput, setPaidAmountInput] = React.useState('0');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [schedulesDialogOpen, setSchedulesDialogOpen] = React.useState(false);
  const [existingSchedules, setExistingSchedules] = React.useState<
    ClientServiceScheduleListItem[]
  >([]);

  if (!canFinish) {
    return null;
  }

  const ticketTotal = total ?? 0;
  const hasServices = serviceLines.length > 0;

  const updatePaidAmountInput = (amount: number) => {
    const safe = Math.max(0, Number.isFinite(amount) ? amount : 0);
    setPaidAmountInput(safe.toFixed(2));
  };

  const getFinalPaidAmount = () =>
    isFullyPaid ? ticketTotal : parsePaidInput(paidAmountInput);

  const downloadServerTicketPdf = () =>
    fetchAndDeliverTicketInvoice({
      ticketId,
      companyId: selectedCompany?.id,
      downloadFileName:
        downloadFileName ||
        `${clientName ?? 'ticket'}_${String(ticketId)}.pdf`,
    });

  const executeFinishAndDownload = async (): Promise<boolean> => {
    const finalPaidAmount = getFinalPaidAmount();

    if (!isFullyPaid && finalPaidAmount > ticketTotal) {
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

  const paidExceedsTotal =
    !isFullyPaid && parsePaidInput(paidAmountInput) > ticketTotal;

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

          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="text-sm font-medium text-foreground">Pago del ticket</p>
            <div className="grid gap-2">
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  isFullyPaid
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border bg-background hover:bg-muted/50',
                )}
                onClick={() => setIsFullyPaid(true)}
              >
                {isFullyPaid ? (
                  <CircleCheck className="h-4 w-4" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4" aria-hidden />
                )}
                Pagado completo (<FormattedCurrency amount={total} />)
              </button>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  !isFullyPaid
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border bg-background hover:bg-muted/50',
                )}
                onClick={() => setIsFullyPaid(false)}
              >
                {!isFullyPaid ? (
                  <CircleCheck className="h-4 w-4" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4" aria-hidden />
                )}
                Pago parcial
              </button>
            </div>

            {!isFullyPaid ? (
              <div className="space-y-2">
                <label
                  htmlFor="detail-paid-amount"
                  className="text-xs text-muted-foreground"
                >
                  Cuánto pagó el cliente
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() =>
                      updatePaidAmountInput(parsePaidInput(paidAmountInput) - 1)
                    }
                    aria-label="Reducir monto pagado"
                  >
                    <Minus className="h-4 w-4" aria-hidden />
                  </Button>
                  <input
                    id="detail-paid-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={paidAmountInput}
                    onChange={(event) => setPaidAmountInput(event.target.value)}
                    onBlur={(event) =>
                      updatePaidAmountInput(parsePaidInput(event.target.value))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-center text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() =>
                      updatePaidAmountInput(parsePaidInput(paidAmountInput) + 1)
                    }
                    aria-label="Aumentar monto pagado"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
                {paidExceedsTotal ? (
                  <p className="text-xs text-destructive">
                    El monto pagado no puede superar el total del ticket.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            onClick={() => void handleFinishClick()}
            disabled={isSubmitting || !hasServices || paidExceedsTotal}
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
