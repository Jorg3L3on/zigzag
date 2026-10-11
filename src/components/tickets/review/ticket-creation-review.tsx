'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, FileText, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  listClientServiceSchedulesForClient,
  upsertClientServiceSchedule,
  type ClientServiceScheduleListItem,
} from '@/actions/client-service-schedules';
import { finishTicket } from '@/actions/tickets';
import { ActionSwap, BlurFade } from '@/components/motion';
import { MoneyFigure } from '@/components/documents/money-figure';
import { InlineSchedulePicker } from '@/components/service-schedules/inline-schedule-picker';
import {
  buildScheduleLineState,
  type TicketFinishScheduleLine,
} from '@/components/service-schedules/schedule-lines';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledMobileStickyActionBar,
} from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { roundMoney, subtractMoney } from '@/lib/money';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import {
  downloadTicketInvoiceFile,
  fetchTicketInvoiceFile,
  shareTicketInvoiceFile,
} from '@/lib/ticket-invoice-download';
import { canDownloadTicketInvoice, canFinishTicket } from '@/lib/tickets-rbac';
import { cn } from '@/lib/utils';
import { GLASS_CARD_CLASS } from '@/components/toolbar-glass';
import { vibrateSuccess } from '@/lib/vibrate-success';
import { buildWhatsAppReceiptShare } from '@/lib/whatsapp-share';
import {
  ReviewSuccessHeader,
  ReviewSummaryCard,
  type ReviewLine,
} from '@/components/tickets/review/document-review-parts';

/** Null serviceId = inline line (ZIG-I5): no service reminder for it. */
export type TicketReviewLine = ReviewLine;

type TicketCreationReviewProps = {
  ticketId: string;
  clientId: number | null;
  clientName: string | null;
  clientTel: string | null;
  ticketDate: string | null;
  total: number;
  paid: number;
  finished: boolean;
  lines: TicketReviewLine[];
  downloadFileName: string;
};

type PayMode = 'full' | 'partial' | 'pending';
type Phase = 'idle' | 'finishing' | 'sharing';

const SECTION_CLASS = GLASS_CARD_CLASS;

const parseAmount = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(roundMoney(parsed), 0) : 0;
};

const PAY_OPTIONS: Array<{ mode: PayMode; label: string }> = [
  { mode: 'full', label: 'Todo' },
  { mode: 'partial', label: 'Una parte' },
  { mode: 'pending', label: 'Nada aún' },
];

/**
 * Creation review (ZIG-I2-5, redesigned in ZIG-I13-3), shown right after
 * Guardar ticket: the Total with a three-line summary, how the client paid, the
 * reminders to schedule, and the recibo as links. One primary CTA: Finalizar y
 * compartir (or Compartir recibo once finished).
 */
export const TicketCreationReview = ({
  ticketId,
  clientId,
  clientName,
  clientTel,
  ticketDate,
  total,
  paid: initialPaid,
  finished: initialFinished,
  lines,
  downloadFileName,
}: TicketCreationReviewProps) => {
  const router = useRouter();
  const { can } = usePermissions();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const canFinish = canFinishTicket(can);
  const canInvoice = canDownloadTicketInvoice(can);

  const [finished, setFinished] = React.useState(initialFinished);
  const [paid, setPaid] = React.useState(initialPaid);
  // No default: Finalizar records nothing the user did not choose (ZIG-I12 Q2).
  const [payMode, setPayMode] = React.useState<PayMode | null>(null);
  const [partialInput, setPartialInput] = React.useState('');
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null);
  const [scheduleLines, setScheduleLines] = React.useState<TicketFinishScheduleLine[]>([]);

  const parsedDate = ticketDate ? new Date(ticketDate) : null;
  const dateLabel =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? format(parsedDate, "d 'de' MMMM yyyy", { locale: es })
      : null;

  const chosenPaid =
    payMode === 'full' ? total : payMode === 'partial' ? parseAmount(partialInput) : 0;
  const partialTooHigh = payMode === 'partial' && chosenPaid > total;
  const hasPayChoice =
    payMode === 'full' ||
    payMode === 'pending' ||
    (payMode === 'partial' && chosenPaid > 0);
  // Once a partial amount is typed the sticky bar shows what is still owed.
  const showsBalance = !finished && payMode === 'partial' && chosenPaid > 0 && !partialTooHigh;
  const busy = phase !== 'idle';

  const serviceLines = React.useMemo(() => {
    const byService = new Map<number, string>();
    lines.forEach((line) => {
      if (line.serviceId != null) byService.set(line.serviceId, line.name);
    });
    return Array.from(byService.entries()).map(([serviceId, serviceName]) => ({
      serviceId,
      serviceName,
    }));
  }, [lines]);

  // The reminders to offer: catalog services only, with what the client already has.
  React.useEffect(() => {
    if (finished || !clientId || serviceLines.length === 0) {
      setScheduleLines([]);
      return;
    }
    let cancelled = false;
    const baseDate = ticketDate ? new Date(ticketDate) : new Date();
    const date = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
    void listClientServiceSchedulesForClient(clientId, companyId).then((result) => {
      if (cancelled) return;
      const existing: ClientServiceScheduleListItem[] = result.data ?? [];
      setScheduleLines(
        serviceLines.map((line) => buildScheduleLineState(line, date, existing)),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [finished, clientId, companyId, serviceLines, ticketDate]);

  const loadReceipt = async (): Promise<File> => {
    if (receiptFile) return receiptFile;
    const file = await fetchTicketInvoiceFile({
      ticketId,
      downloadFileName,
      companyId,
    });
    setReceiptFile(file);
    return file;
  };

  const openWhatsAppFallback = (paidAmount: number): boolean => {
    const share = buildWhatsAppReceiptShare({
      phone: clientTel,
      clientName,
      ticketId,
      total,
      paid: paidAmount,
      companyName: selectedCompany?.name,
    });
    if (!share) return false;
    window.open(share.href, '_blank', 'noopener,noreferrer');
    return true;
  };

  const shareReceipt = async (paidAmount: number) => {
    setPhase('sharing');
    try {
      const file = await loadReceipt();
      const result = await shareTicketInvoiceFile(file, {
        title: `Recibo ticket #${ticketId}`,
        text: clientName ? `Recibo de ${clientName}` : undefined,
      });
      if (result === 'shared') {
        toast.success('Recibo compartido');
      } else if (result === 'needs-gesture') {
        toast.message('Recibo listo', {
          description: 'Toca Compartir recibo para enviarlo.',
        });
      } else if (result === 'unsupported') {
        if (openWhatsAppFallback(paidAmount)) {
          toast.success('Abrimos WhatsApp con el resumen del recibo');
        } else {
          downloadTicketInvoiceFile(file);
          toast.success('PDF descargado');
        }
      }
    } catch (error) {
      const errorType = classifyClientError(error);
      toast.error(getErrorMessageByType(errorType, 'No se pudo preparar el recibo'));
    } finally {
      setPhase('idle');
    }
  };

  const handleFinishAndShare = async () => {
    if (busy || partialTooHigh || !hasPayChoice) return;
    const paidAmount = roundMoney(chosenPaid);
    setPhase('finishing');
    try {
      const result = await finishTicket(
        Number(ticketId),
        total,
        paidAmount,
        companyId,
      );
      if (!result.success) {
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudo finalizar el ticket',
          ),
        );
        setPhase('idle');
        return;
      }

      setFinished(true);
      setPaid(paidAmount);
      vibrateSuccess();
      toast.success(`Ticket #${ticketId} finalizado`);

      router.refresh();

      // Reminders chosen on this screen are saved before the share sheet opens,
      // so the sheet is the last thing the user sees (ZIG-I13-3).
      await saveSchedules();

      if (canInvoice) {
        await shareReceipt(paidAmount);
      } else {
        setPhase('idle');
      }
    } catch (error) {
      const errorType = classifyClientError(error);
      toast.error(getErrorMessageByType(errorType, 'No se pudo finalizar el ticket'));
      setPhase('idle');
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const file = await loadReceipt();
      downloadTicketInvoiceFile(file);
      toast.success('PDF descargado');
    } catch (error) {
      const errorType = classifyClientError(error);
      toast.error(getErrorMessageByType(errorType, 'No se pudo descargar el PDF'));
    } finally {
      setIsDownloading(false);
    }
  };

  const saveSchedules = async () => {
    if (!clientId) return;
    for (const line of scheduleLines.filter((item) => item.checked)) {
      const upsert = await upsertClientServiceSchedule({
        clientId,
        serviceId: line.serviceId,
        intervalValue: line.intervalValue,
        intervalUnit: line.intervalUnit,
        lastServiceAt: line.lastServiceAt,
        companyId,
      });
      if (!upsert.success) {
        toast.error(upsert.error || 'No se pudo guardar un recordatorio');
      }
    }
  };

  const primaryCta = !finished && canFinish ? (
    <Button
      type="button"
      className="h-12 w-full rounded-xl text-base font-semibold md:w-auto md:min-w-56"
      disabled={busy || partialTooHigh || !hasPayChoice || lines.length === 0}
      onClick={() => void handleFinishAndShare()}
    >
      <ActionSwap swapKey={phase}>
        {phase === 'finishing' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Finalizando…
          </>
        ) : phase === 'sharing' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Preparando recibo…
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" aria-hidden />
            Finalizar y compartir
          </>
        )}
      </ActionSwap>
    </Button>
  ) : finished && canInvoice ? (
    <Button
      type="button"
      className="h-12 w-full rounded-xl text-base font-semibold md:w-auto md:min-w-56"
      disabled={busy}
      onClick={() => void shareReceipt(paid)}
    >
      <ActionSwap swapKey={phase}>
        {phase === 'sharing' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Preparando recibo…
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" aria-hidden />
            Compartir recibo
          </>
        )}
      </ActionSwap>
    </Button>
  ) : null;

  return (
    <>
      <TripledDashboardShell
        maxWidthClassName="max-w-2xl"
        contentClassName="space-y-3 md:space-y-4"
      >
        <TripledMobileAppBar
          title={`Ticket #${ticketId} ${finished ? 'finalizado' : 'guardado'}`}
          subtitle={clientName ?? undefined}
          backHref="/tickets"
          backLabel="Volver a tickets"
        />

        <BlurFade>
          <ReviewSuccessHeader
            hideOnMobile
            title={`Ticket #${ticketId} ${finished ? 'finalizado' : 'guardado'}`}
            subtitle={[clientName, dateLabel].filter(Boolean).join(' · ')}
          />
        </BlurFade>

        <BlurFade delay={0.05}>
          <ReviewSummaryCard
            lines={lines}
            total={total}
            linesLabel="Servicios del ticket"
            paid={finished ? paid : undefined}
          />
        </BlurFade>

        {!finished && canFinish ? (
          <BlurFade delay={0.1}>
            <section aria-labelledby="review-pay-heading" className={cn(SECTION_CLASS, 'space-y-3')}>
              <h2 id="review-pay-heading" className="text-[15px] font-semibold">
                ¿Cómo pagó el cliente?
              </h2>
              <div role="radiogroup" aria-labelledby="review-pay-heading" className="flex gap-2">
                {PAY_OPTIONS.map((option) => {
                  const selected = payMode === option.mode;
                  return (
                    <button
                      key={option.mode}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPayMode(option.mode)}
                      className={cn(
                        'h-12 min-w-0 flex-1 rounded-[10px] border px-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selected
                          ? 'border-primary bg-primary/15 font-semibold'
                          : 'border-border bg-background hover:bg-muted/50',
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {payMode === null ? (
                <p className="text-xs text-muted-foreground" data-testid="review-pay-hint">
                  Elige cómo pagó el cliente para finalizar.
                </p>
              ) : null}
              {payMode === 'partial' ? (
                <div className="space-y-1.5">
                  <label htmlFor="review-paid-amount" className="text-[13px] text-muted-foreground">
                    Cuánto pagó
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <input
                      id="review-paid-amount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={partialInput}
                      onChange={(event) => setPartialInput(event.target.value)}
                      className="h-12 w-full rounded-[10px] border border-primary bg-background pl-8 pr-3 text-base tabular-nums"
                      placeholder="0.00"
                    />
                  </div>
                  {partialTooHigh ? (
                    <p className="text-xs text-destructive" role="alert">
                      No puede ser mayor que el total.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          </BlurFade>
        ) : null}

        {!finished && canFinish && scheduleLines.length > 0 ? (
          <BlurFade delay={0.12}>
            <InlineSchedulePicker
              className={SECTION_CLASS}
              lines={scheduleLines}
              onChange={setScheduleLines}
              disabled={busy}
            />
          </BlurFade>
        ) : null}

        {canInvoice ? (
          <BlurFade delay={0.15}>
            <div
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm"
              data-testid="review-recibo-links"
            >
              <Link
                href={`/tickets/${ticketId}/recibo?from=listo`}
                className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
              >
                <FileText className="h-4 w-4" aria-hidden />
                Abrir PDF
              </Link>
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => void handleDownload()}
                className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-4 w-4" aria-hidden />
                )}
                Descargar PDF
              </button>
            </div>
          </BlurFade>
        ) : null}

        <div className="hidden items-center justify-between gap-4 md:flex">
          {!finished ? (
            <Link
              href={`/tickets/${ticketId}`}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Guardar sin finalizar
            </Link>
          ) : (
            <Link
              href={`/tickets/${ticketId}`}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Ver ticket
            </Link>
          )}
          {primaryCta}
        </div>

        <div className="flex justify-center gap-6 text-sm md:hidden">
          <Link
            href={`/tickets/${ticketId}`}
            className="inline-flex min-h-11 items-center font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            {finished ? 'Ver ticket' : 'Guardar sin finalizar'}
          </Link>
          {finished ? (
            <Link
              href="/tickets/create"
              className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
            >
              Nuevo ticket
            </Link>
          ) : null}
        </div>
      </TripledDashboardShell>

      {primaryCta ? (
        <TripledMobileStickyActionBar>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'text-xs',
                showsBalance ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
              )}
            >
              {finished ? 'Pagado' : showsBalance ? 'Saldo pendiente' : 'Total'}
            </p>
            <MoneyFigure
              amount={finished ? paid : showsBalance ? subtractMoney(total, chosenPaid) : total}
              // md, not lg: next to Finalizar y compartir a 7-figure balance would wrap mid-number at 375px.
              size="md"
              className="block text-[17px] leading-tight"
              data-testid="review-sticky-amount"
            />
          </div>
          <div className="shrink-0">{primaryCta}</div>
        </TripledMobileStickyActionBar>
      ) : null}
    </>
  );
};
