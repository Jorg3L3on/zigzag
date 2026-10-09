'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Circle,
  CircleCheck,
  Download,
  ExternalLink,
  Loader2,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  listClientServiceSchedulesForClient,
  upsertClientServiceSchedule,
  type ClientServiceScheduleListItem,
} from '@/actions/client-service-schedules';
import { finishTicket } from '@/actions/tickets';
import { ActionSwap, BlurFade, DrawCheck, NumberTicker } from '@/components/motion';
import {
  TicketFinishSchedulesDialog,
  type TicketFinishScheduleLine,
} from '@/components/service-schedules/ticket-finish-schedules-dialog';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledMobileStickyActionBar,
} from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { multiplyMoney, roundMoney, subtractMoney } from '@/lib/money';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import {
  downloadTicketInvoiceFile,
  fetchTicketInvoiceFile,
  shareTicketInvoiceFile,
} from '@/lib/ticket-invoice-download';
import { buildTicketInvoicePreviewUrl } from '@/lib/ticket-invoice-url';
import { canDownloadTicketInvoice, canFinishTicket } from '@/lib/tickets-rbac';
import { cn } from '@/lib/utils';
import { GLASS_CARD_CLASS } from '@/components/toolbar-glass';
import { vibrateSuccess } from '@/lib/vibrate-success';
import { buildWhatsAppReceiptShare } from '@/lib/whatsapp-share';

export type TicketReviewLine = {
  id: number;
  /** Null for an inline line (ZIG-I5): no service reminder for it. */
  serviceId: number | null;
  name: string;
  quantity: number;
  price: number;
};

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

const subscribeNoop = () => () => {};
const readPdfViewerEnabled = () =>
  typeof navigator !== 'undefined' &&
  (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled === true;
const serverPdfViewerEnabled = () => false;

/** Inline PDF only where the browser can render it (not Android Chrome, not headless). */
const usePdfViewerEnabled = () =>
  React.useSyncExternalStore(
    subscribeNoop,
    readPdfViewerEnabled,
    serverPdfViewerEnabled,
  );

const parseAmount = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(roundMoney(parsed), 0) : 0;
};

const PAY_OPTIONS: Array<{ mode: PayMode; label: string; hint: string }> = [
  { mode: 'full', label: 'Pagado completo', hint: 'El cliente pagó todo' },
  { mode: 'partial', label: 'Pago parcial', hint: 'Dejó un anticipo' },
  { mode: 'pending', label: 'Pendiente', hint: 'Cobras después' },
];

type ReciboSummaryProps = {
  ticketId: string;
  clientName: string | null;
  dateLabel: string | null;
  lines: TicketReviewLine[];
  total: number;
  paid: number;
};

/** HTML stand-in for the PDF where the browser cannot show it inline. */
const ReciboSummary = ({
  ticketId,
  clientName,
  dateLabel,
  lines,
  total,
  paid,
}: ReciboSummaryProps) => {
  const balance = Math.max(subtractMoney(total, paid), 0);
  return (
    <div
      data-testid="recibo-summary"
      className="rounded-xl border border-dashed border-border/80 bg-background p-4 text-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">Recibo · Ticket #{ticketId}</p>
        {dateLabel ? (
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        ) : null}
      </div>
      {clientName ? (
        <p className="mt-0.5 text-muted-foreground">{clientName}</p>
      ) : null}
      <ul className="mt-3 space-y-1.5">
        {lines.map((line) => (
          <li key={line.id} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">
              {line.quantity} × {line.name}
            </span>
            <span className="shrink-0 tabular-nums">
              {formatServiceCurrency(multiplyMoney(line.price, line.quantity))}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 border-t border-border/60 pt-3 tabular-nums">
        <div className="flex justify-between font-semibold">
          <dt>Total</dt>
          <dd>{formatServiceCurrency(total)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>Pagado</dt>
          <dd>{formatServiceCurrency(paid)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>Saldo</dt>
          <dd>{formatServiceCurrency(balance)}</dd>
        </div>
      </dl>
    </div>
  );
};

/**
 * Creation review (ZIG-I2-5), shown right after Guardar ticket: client, date,
 * lines, total, pago choice and the recibo with Compartir / Descargar. One
 * primary CTA: Finalizar y compartir (or Compartir recibo once finished).
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
  const reduceMotion = useReducedMotion();
  const { can } = usePermissions();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const canFinish = canFinishTicket(can);
  const canInvoice = canDownloadTicketInvoice(can);
  const pdfViewerEnabled = usePdfViewerEnabled();

  const [finished, setFinished] = React.useState(initialFinished);
  const [paid, setPaid] = React.useState(initialPaid);
  const [payMode, setPayMode] = React.useState<PayMode>('full');
  const [partialInput, setPartialInput] = React.useState('');
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null);
  const [schedulesOpen, setSchedulesOpen] = React.useState(false);
  const [existingSchedules, setExistingSchedules] = React.useState<
    ClientServiceScheduleListItem[]
  >([]);
  const [savingSchedules, setSavingSchedules] = React.useState(false);

  const parsedDate = ticketDate ? new Date(ticketDate) : null;
  const dateLabel =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? format(parsedDate, "d 'de' MMMM yyyy", { locale: es })
      : null;

  const chosenPaid =
    payMode === 'full' ? total : payMode === 'pending' ? 0 : parseAmount(partialInput);
  const partialTooHigh = payMode === 'partial' && chosenPaid > total;
  const shownPaid = finished ? paid : chosenPaid;
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
    if (busy || partialTooHigh) return;
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

      if (canInvoice) {
        await shareReceipt(paidAmount);
      } else {
        setPhase('idle');
      }

      router.refresh();

      if (clientId && serviceLines.length > 0) {
        const schedules = await listClientServiceSchedulesForClient(
          clientId,
          companyId,
        );
        setExistingSchedules(schedules.data ?? []);
        setSchedulesOpen(true);
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

  const handleSchedulesConfirm = async (scheduleLines: TicketFinishScheduleLine[]) => {
    if (!clientId) return;
    setSavingSchedules(true);
    try {
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
      setSchedulesOpen(false);
    } finally {
      setSavingSchedules(false);
    }
  };

  const primaryCta = !finished && canFinish ? (
    <Button
      type="button"
      className="h-12 w-full rounded-xl text-base font-semibold md:w-auto md:min-w-56"
      disabled={busy || partialTooHigh || lines.length === 0}
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
        contentClassName="space-y-4"
      >
        <TripledMobileAppBar
          title={`Ticket #${ticketId}`}
          subtitle={finished ? 'Finalizado' : 'Guardado'}
          backHref="/tickets"
          backLabel="Volver a tickets"
        />

        <BlurFade>
          <header className="flex items-center gap-3 px-1 py-2" data-testid="review-header">
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 420, damping: 22 }
              }
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            >
              <DrawCheck className="size-6" delay={0.1} />
            </motion.span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">
                Ticket #{ticketId} {finished ? 'finalizado' : 'guardado'}
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                {[clientName, dateLabel].filter(Boolean).join(' · ')}
              </p>
            </div>
          </header>
        </BlurFade>

        <BlurFade delay={0.05}>
          <section aria-labelledby="review-lines-heading" className={SECTION_CLASS}>
            <h2 id="review-lines-heading" className="text-base font-semibold">
              Servicios
            </h2>
            <ul className="mt-2 divide-y divide-border/60" aria-label="Servicios del ticket">
              {lines.map((line) => (
                <li key={line.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{line.name}</p>
                    <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                      {line.quantity} × {formatServiceCurrency(line.price)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatServiceCurrency(multiplyMoney(line.price, line.quantity))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex items-baseline justify-between border-t border-border/60 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total
              </span>
              <NumberTicker
                value={total}
                format={formatServiceCurrency}
                className="text-2xl font-semibold"
                data-testid="review-total"
              />
            </div>
          </section>
        </BlurFade>

        {!finished && canFinish ? (
          <BlurFade delay={0.1}>
            <section aria-labelledby="review-pay-heading" className={SECTION_CLASS}>
              <h2 id="review-pay-heading" className="text-base font-semibold">
                Pago
              </h2>
              <div
                role="radiogroup"
                aria-labelledby="review-pay-heading"
                className="mt-3 grid gap-2"
              >
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
                        'flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                        selected
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border bg-background hover:bg-muted/50',
                      )}
                    >
                      {selected ? (
                        <CircleCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      </span>
                      {option.mode === 'full' ? (
                        <span className="text-sm font-semibold tabular-nums">
                          {formatServiceCurrency(total)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {payMode === 'partial' ? (
                <div className="mt-3 space-y-1.5">
                  <label htmlFor="review-paid-amount" className="text-sm font-medium">
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
                      className="h-12 w-full rounded-xl border border-input bg-background pl-8 pr-3 text-base tabular-nums"
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

        <BlurFade delay={0.15}>
          <section aria-labelledby="review-recibo-heading" className={SECTION_CLASS}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="review-recibo-heading" className="text-base font-semibold">
                Recibo
              </h2>
              {finished && canInvoice ? (
                <a
                  href={buildTicketInvoicePreviewUrl(ticketId, companyId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Abrir PDF
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : null}
            </div>
            <div className="mt-3">
              {finished && canInvoice && pdfViewerEnabled ? (
                <object
                  data={buildTicketInvoicePreviewUrl(ticketId, companyId)}
                  type="application/pdf"
                  aria-label={`Vista previa del recibo del ticket ${ticketId}`}
                  data-testid="recibo-pdf-preview"
                  className="h-[440px] w-full rounded-xl border border-border/60 bg-muted/20"
                >
                  <ReciboSummary
                    ticketId={ticketId}
                    clientName={clientName}
                    dateLabel={dateLabel}
                    lines={lines}
                    total={total}
                    paid={shownPaid}
                  />
                </object>
              ) : (
                <ReciboSummary
                  ticketId={ticketId}
                  clientName={clientName}
                  dateLabel={dateLabel}
                  lines={lines}
                  total={total}
                  paid={shownPaid}
                />
              )}
            </div>
            {canInvoice ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1 gap-2 rounded-xl"
                  disabled={isDownloading}
                  onClick={() => void handleDownload()}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden />
                  )}
                  Descargar PDF
                </Button>
              </div>
            ) : null}
          </section>
        </BlurFade>

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
            className="font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            {finished ? 'Ver ticket' : 'Guardar sin finalizar'}
          </Link>
          {finished ? (
            <Link
              href="/tickets/create"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Nuevo ticket
            </Link>
          ) : null}
        </div>
      </TripledDashboardShell>

      {primaryCta ? (
        <TripledMobileStickyActionBar>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {finished ? 'Pagado' : 'Total'}
            </p>
            <p className="truncate text-base font-semibold tabular-nums">
              {formatServiceCurrency(finished ? paid : total)}
            </p>
          </div>
          <div className="shrink-0">{primaryCta}</div>
        </TripledMobileStickyActionBar>
      ) : null}

      <TicketFinishSchedulesDialog
        open={schedulesOpen}
        onOpenChange={setSchedulesOpen}
        ticketDate={parsedDate ?? new Date()}
        serviceLines={serviceLines}
        existingSchedules={existingSchedules}
        saving={savingSchedules}
        onConfirm={(scheduleLines) => void handleSchedulesConfirm(scheduleLines)}
        onSkip={() => setSchedulesOpen(false)}
      />
    </>
  );
};
