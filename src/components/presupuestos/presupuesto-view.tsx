'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRightLeft,
  Ban,
  CalendarClock,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Share2,
  Ticket,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  cancelPresupuesto,
  convertPresupuestoToTicket,
} from '@/actions/presupuestos';
import { ActionSwap, BlurFade } from '@/components/motion';
import {
  QuoteSummary,
  REVIEW_SECTION_CLASS,
  ReviewLinesSection,
  ReviewSuccessHeader,
  usePdfViewerEnabled,
  type ReviewLine,
} from '@/components/tickets/review/document-review-parts';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledMobileStickyActionBar,
} from '@/components/tripled';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatLongDate } from '@/lib/format-long-date';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import {
  PRESUPUESTO_STATUS_LABEL,
  type PresupuestoStatus,
} from '@/lib/ticket-document-kind';
import {
  downloadTicketInvoiceFile,
  fetchTicketInvoiceFile,
  shareTicketInvoiceFile,
} from '@/lib/ticket-invoice-download';
import { buildTicketInvoicePreviewUrl } from '@/lib/ticket-invoice-url';
import { canDownloadTicketInvoice, canWriteTickets } from '@/lib/tickets-rbac';
import { buildWhatsAppQuoteShare } from '@/lib/whatsapp-share';

export type PresupuestoViewProps = {
  /** review: right after Guardar presupuesto. detail: later visits. */
  variant: 'review' | 'detail';
  presupuestoId: string;
  clientId: number | null;
  clientName: string | null;
  clientTel: string | null;
  ticketDate: string | null;
  expiresAt: string | null;
  workNotes: string | null;
  total: number;
  lines: ReviewLine[];
  status: PresupuestoStatus;
  convertedToTicketId: string | null;
  downloadFileName: string;
  /** Editar shows only when the edit route exists (ZIG-I5-5). */
  editHref?: string | null;
};

const STATUS_BADGE_VARIANT: Record<
  PresupuestoStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  abierto: 'default',
  vencido: 'destructive',
  convertido: 'secondary',
  cancelado: 'outline',
};

/**
 * Presupuesto review (ZIG-I5-4, /presupuestos/[id]/listo) and detail
 * (/presupuestos/[id]). One primary CTA: Compartir presupuesto (share sheet with
 * the PDF, WhatsApp text with Válido hasta as the fallback). No Pago, Finalizar,
 * Recordatorios or Actividad: a quote is not a work ticket.
 */
export const PresupuestoView = ({
  variant,
  presupuestoId,
  clientId,
  clientName,
  clientTel,
  ticketDate,
  expiresAt,
  workNotes,
  total,
  lines,
  status,
  convertedToTicketId,
  downloadFileName,
  editHref = null,
}: PresupuestoViewProps) => {
  const router = useRouter();
  const { can } = usePermissions();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const canInvoice = canDownloadTicketInvoice(can);
  const canWrite = canWriteTickets(can);
  const pdfViewerEnabled = usePdfViewerEnabled();

  const [phase, setPhase] = React.useState<'idle' | 'sharing' | 'downloading'>('idle');
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [confirm, setConfirm] = React.useState<'convert' | 'cancel' | null>(null);
  const [mutating, setMutating] = React.useState(false);

  const isMutable = status === 'abierto' || status === 'vencido';
  const dateLabel = formatLongDate(ticketDate);
  const expiresLabel = formatLongDate(expiresAt);
  const servicesSummary = lines
    .slice(0, 3)
    .map((line) => line.name)
    .join(', ');

  const loadPdf = async (): Promise<File> => {
    if (pdfFile) return pdfFile;
    const file = await fetchTicketInvoiceFile({
      ticketId: presupuestoId,
      downloadFileName,
      companyId,
    });
    setPdfFile(file);
    return file;
  };

  const openWhatsAppFallback = (): boolean => {
    const share = buildWhatsAppQuoteShare({
      phone: clientTel,
      clientName,
      ticketId: presupuestoId,
      total,
      servicesSummary,
      validUntil: expiresAt,
      companyName: selectedCompany?.name,
    });
    if (!share) return false;
    window.open(share.href, '_blank', 'noopener,noreferrer');
    return true;
  };

  const handleShare = async () => {
    if (phase !== 'idle') return;
    setPhase('sharing');
    try {
      let result: Awaited<ReturnType<typeof shareTicketInvoiceFile>> = 'unsupported';
      let file: File | null = null;
      if (canInvoice) {
        file = await loadPdf();
        result = await shareTicketInvoiceFile(file, {
          title: `Presupuesto #${presupuestoId}`,
          text: clientName ? `Presupuesto para ${clientName}` : undefined,
        });
      }
      if (result === 'shared') {
        toast.success('Presupuesto compartido');
      } else if (result === 'needs-gesture') {
        toast.message('Presupuesto listo', {
          description: 'Toca Compartir presupuesto para enviarlo.',
        });
      } else if (result === 'unsupported') {
        if (openWhatsAppFallback()) {
          toast.success('Abrimos WhatsApp con el resumen del presupuesto');
        } else if (file) {
          downloadTicketInvoiceFile(file);
          toast.success('PDF descargado');
        } else {
          toast.error('Agrega un teléfono al cliente para compartirlo');
        }
      }
    } catch {
      toast.error('No se pudo preparar el presupuesto');
    } finally {
      setPhase('idle');
    }
  };

  const handleDownload = async () => {
    if (phase !== 'idle') return;
    setPhase('downloading');
    try {
      downloadTicketInvoiceFile(await loadPdf());
    } catch {
      toast.error('No se pudo descargar el PDF');
    } finally {
      setPhase('idle');
    }
  };

  const handleConvert = async () => {
    setMutating(true);
    try {
      const result = await convertPresupuestoToTicket(Number(presupuestoId), companyId);
      if (!result.success || !result.data) {
        toast.error(getErrorDisplayMessage(result, 'No se pudo convertir el presupuesto'));
        return;
      }
      toast.success(`Convertido a ticket #${result.data.ticketId}`);
      router.push(`/tickets/${result.data.ticketId}`);
    } finally {
      setMutating(false);
      setConfirm(null);
    }
  };

  const handleCancel = async () => {
    setMutating(true);
    try {
      const result = await cancelPresupuesto(Number(presupuestoId), companyId);
      if (!result.success) {
        toast.error(getErrorDisplayMessage(result, 'No se pudo cancelar el presupuesto'));
        return;
      }
      toast.success('Presupuesto cancelado');
      router.refresh();
    } finally {
      setMutating(false);
      setConfirm(null);
    }
  };

  const renderShareCta = (compact: boolean) =>
    status === 'cancelado' ? null : (
      <Button
        type="button"
        aria-label={compact ? 'Compartir presupuesto' : undefined}
        className={
          compact
            ? 'h-12 rounded-xl px-5 text-base font-semibold'
            : 'h-12 w-full rounded-xl text-base font-semibold md:w-auto md:min-w-56'
        }
        disabled={phase !== 'idle'}
        onClick={() => void handleShare()}
      >
        <ActionSwap swapKey={phase === 'sharing' ? 'sharing' : 'idle'}>
          {phase === 'sharing' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {compact ? 'Preparando…' : 'Preparando presupuesto…'}
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" aria-hidden />
              {compact ? 'Compartir' : 'Compartir presupuesto'}
            </>
          )}
        </ActionSwap>
      </Button>
    );
  const shareCta = renderShareCta(false);
  const compactShareCta = renderShareCta(true);

  const title =
    variant === 'review'
      ? `Presupuesto #${presupuestoId} guardado`
      : `Presupuesto #${presupuestoId}`;

  return (
    <>
      <TripledDashboardShell maxWidthClassName="max-w-2xl" contentClassName="space-y-4">
        <TripledMobileAppBar
          title={`Presupuesto #${presupuestoId}`}
          subtitle={variant === 'review' ? 'Guardado' : PRESUPUESTO_STATUS_LABEL[status]}
          backHref="/presupuestos"
          backLabel="Volver a presupuestos"
        />

        <BlurFade>
          {variant === 'review' ? (
            <ReviewSuccessHeader
              title={title}
              subtitle={[clientName, dateLabel].filter(Boolean).join(' · ')}
            />
          ) : (
            <header className="space-y-1 px-1 py-2" data-testid="presupuesto-header">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                <Badge
                  variant={STATUS_BADGE_VARIANT[status]}
                  className="shadow-none"
                  data-testid="presupuesto-status"
                >
                  {PRESUPUESTO_STATUS_LABEL[status]}
                </Badge>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {[clientName, dateLabel].filter(Boolean).join(' · ')}
              </p>
            </header>
          )}
        </BlurFade>

        {status === 'convertido' && convertedToTicketId ? (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm"
          >
            <span className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-muted-foreground" aria-hidden />
              Convertido en Ticket #{convertedToTicketId}
            </span>
            <Link
              href={`/tickets/${convertedToTicketId}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver ticket
            </Link>
          </div>
        ) : null}
        {status === 'cancelado' ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
          >
            <Ban className="h-4 w-4" aria-hidden />
            Presupuesto cancelado. Sólo lectura.
          </div>
        ) : null}

        <BlurFade delay={0.05}>
          <section aria-labelledby="presupuesto-info-heading" className={REVIEW_SECTION_CLASS}>
            <h2 id="presupuesto-info-heading" className="sr-only">
              Datos del presupuesto
            </h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cliente
                </dt>
                <dd className="mt-0.5 font-medium">
                  {clientId ? (
                    <Link
                      href={`/clients/${clientId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {clientName ?? 'Cliente'}
                    </Link>
                  ) : (
                    (clientName ?? '—')
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Vence
                </dt>
                <dd
                  className="mt-0.5 flex items-center gap-1.5 font-medium"
                  data-testid="presupuesto-expires"
                >
                  <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {expiresLabel ?? 'Sin vencimiento'}
                </dd>
              </div>
            </dl>
            {workNotes ? (
              <p className="mt-3 whitespace-pre-line border-t border-border/60 pt-3 text-sm text-muted-foreground">
                {workNotes}
              </p>
            ) : null}
          </section>
        </BlurFade>

        <BlurFade delay={0.1}>
          <ReviewLinesSection
            lines={lines}
            total={total}
            linesLabel="Servicios del presupuesto"
            showInlineChips
          />
        </BlurFade>

        <BlurFade delay={0.15}>
          <section aria-labelledby="presupuesto-pdf-heading" className={REVIEW_SECTION_CLASS}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="presupuesto-pdf-heading" className="text-base font-semibold">
                Presupuesto en PDF
              </h2>
              {canInvoice ? (
                <a
                  href={buildTicketInvoicePreviewUrl(presupuestoId, companyId)}
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
              {canInvoice && pdfViewerEnabled ? (
                <object
                  data={buildTicketInvoicePreviewUrl(presupuestoId, companyId)}
                  type="application/pdf"
                  aria-label={`Vista previa del presupuesto ${presupuestoId}`}
                  data-testid="presupuesto-pdf-preview"
                  className="h-[440px] w-full rounded-xl border border-border/60 bg-muted/20"
                >
                  <QuoteSummary
                    presupuestoId={presupuestoId}
                    clientName={clientName}
                    dateLabel={dateLabel}
                    expiresLabel={expiresLabel}
                    lines={lines}
                    total={total}
                  />
                </object>
              ) : (
                <QuoteSummary
                  presupuestoId={presupuestoId}
                  clientName={clientName}
                  dateLabel={dateLabel}
                  expiresLabel={expiresLabel}
                  lines={lines}
                  total={total}
                />
              )}
            </div>
            {canInvoice ? (
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-11 w-full gap-2 rounded-xl"
                disabled={phase !== 'idle'}
                onClick={() => void handleDownload()}
              >
                {phase === 'downloading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-4 w-4" aria-hidden />
                )}
                Descargar PDF
              </Button>
            ) : null}
          </section>
        </BlurFade>

        {variant === 'detail' && canWrite && isMutable ? (
          <BlurFade delay={0.2}>
            <section aria-label="Acciones del presupuesto" className="grid gap-2 sm:grid-cols-3">
              {editHref ? (
                <Button asChild variant="outline" className="h-11 gap-2 rounded-xl">
                  <Link href={editHref}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Editar
                  </Link>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2 rounded-xl"
                disabled={mutating}
                onClick={() => setConfirm('convert')}
              >
                <ArrowRightLeft className="h-4 w-4" aria-hidden />
                Convertir a ticket
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 gap-2 rounded-xl text-destructive hover:text-destructive"
                disabled={mutating}
                onClick={() => setConfirm('cancel')}
              >
                <Ban className="h-4 w-4" aria-hidden />
                Cancelar presupuesto
              </Button>
            </section>
          </BlurFade>
        ) : null}

        <div className="hidden items-center justify-between gap-4 md:flex">
          {variant === 'review' ? (
            <Link
              href={`/presupuestos/${presupuestoId}`}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Ver presupuesto
            </Link>
          ) : (
            <span />
          )}
          {shareCta}
        </div>

        {variant === 'review' ? (
          <div className="flex justify-center gap-6 text-sm md:hidden">
            <Link
              href={`/presupuestos/${presupuestoId}`}
              className="font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              Ver presupuesto
            </Link>
            <Link
              href="/presupuestos/create"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Nuevo presupuesto
            </Link>
          </div>
        ) : null}
      </TripledDashboardShell>

      {shareCta ? (
        <TripledMobileStickyActionBar>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="truncate text-base font-semibold tabular-nums">
              {formatServiceCurrency(total)}
            </p>
          </div>
          <div className="shrink-0">{compactShareCta}</div>
        </TripledMobileStickyActionBar>
      ) : null}

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !mutating) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'convert'
                ? `¿Convertir el presupuesto #${presupuestoId} en ticket?`
                : `¿Cancelar el presupuesto #${presupuestoId}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'convert'
                ? 'Se crea un ticket de trabajo con los mismos servicios y precios. El presupuesto queda como Convertido.'
                : 'Sale de los presupuestos abiertos y queda sólo para consulta. No se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutating}>Volver</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutating}
              className={
                confirm === 'cancel'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
              onClick={(event) => {
                event.preventDefault();
                void (confirm === 'convert' ? handleConvert() : handleCancel());
              }}
            >
              {mutating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {confirm === 'convert' ? 'Convertir a ticket' : 'Cancelar presupuesto'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
