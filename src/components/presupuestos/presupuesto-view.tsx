'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Ban,
  CalendarClock,
  Download,
  FileText,
  Loader2,
  Share2,
  Ticket,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  cancelPresupuesto,
  convertPresupuestoToTicket,
  duplicatePresupuesto,
} from '@/actions/presupuestos';
import { ConfirmSheet } from '@/components/documents/confirm-sheet';
import { PresupuestoDetailLayout } from '@/components/presupuestos/presupuesto-detail-layout';
import { ActionSwap, BlurFade } from '@/components/motion';
import {
  REVIEW_SECTION_CLASS,
  ReviewSuccessHeader,
  ReviewSummaryCard,
  type ReviewLine,
} from '@/components/tickets/review/document-review-parts';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledMobileStickyActionBar,
} from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { collapseBlankLines } from '@/lib/collapse-blank-lines';
import { formatLongDate } from '@/lib/format-long-date';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import type { PresupuestoStatus } from '@/lib/ticket-document-kind';
import {
  downloadTicketInvoiceFile,
  fetchTicketInvoiceFile,
  shareTicketInvoiceFile,
} from '@/lib/ticket-invoice-download';
import { canDownloadTicketInvoice, canWriteTickets } from '@/lib/tickets-rbac';
import {
  buildPresupuestoComposerDraftKey,
  writeTicketComposerDraft,
} from '@/lib/ticket-composer-draft';
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

  const [phase, setPhase] = React.useState<'idle' | 'sharing' | 'downloading'>('idle');
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [confirm, setConfirm] = React.useState<'convert' | 'cancel' | null>(null);
  const [mutating, setMutating] = React.useState(false);
  const [duplicating, setDuplicating] = React.useState(false);

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

  /** Duplicar: a draft in the presupuesto composer, saved only on Guardar (ZIG-I13-5). */
  const handleDuplicate = async () => {
    if (duplicating) return;
    setDuplicating(true);
    try {
      const result = await duplicatePresupuesto(Number(presupuestoId), companyId);
      if (!result.success) {
        toast.error(getErrorDisplayMessage(result, 'No se pudo duplicar el presupuesto'));
        return;
      }
      const draft = result.data;
      if (companyId) {
        writeTicketComposerDraft(buildPresupuestoComposerDraftKey(companyId), {
          client_id: draft.client.id > 0 ? draft.client.id : undefined,
          client_label: draft.client.label,
          ticket_date: draft.ticketDate,
          ...(draft.expiresAt ? { expires_at: draft.expiresAt } : {}),
          work_notes: draft.notes,
          lines: draft.lines,
        });
      }
      toast.success('Borrador listo: revísalo y guarda');
      router.push('/presupuestos/create');
    } catch {
      toast.error('No se pudo duplicar el presupuesto');
    } finally {
      setDuplicating(false);
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

  const title = `Presupuesto #${presupuestoId} guardado`;

  const confirmSheet = (
    <ConfirmSheet
      open={confirm !== null}
      onOpenChange={(open) => {
        if (!open && !mutating) setConfirm(null);
      }}
      title={
        confirm === 'convert'
          ? `¿Convertir el presupuesto #${presupuestoId} en ticket?`
          : `¿Cancelar el presupuesto #${presupuestoId}?`
      }
      description={
        confirm === 'convert'
          ? 'Se crea un ticket de trabajo con los mismos servicios y precios. El presupuesto queda como Convertido.'
          : 'Sale de los presupuestos abiertos y queda sólo para consulta. No se puede deshacer.'
      }
      confirmLabel={confirm === 'convert' ? 'Convertir a ticket' : 'Cancelar presupuesto'}
      cancelLabel="Volver"
      destructive={confirm === 'cancel'}
      pending={mutating}
      onConfirm={() => (confirm === 'convert' ? handleConvert() : handleCancel())}
    />
  );

  if (variant === 'detail') {
    return (
      <>
        <PresupuestoDetailLayout
          presupuestoId={presupuestoId}
          clientId={clientId}
          clientName={clientName}
          ticketDate={ticketDate}
          expiresAt={expiresAt}
          workNotes={workNotes}
          total={total}
          lines={lines}
          status={status}
          convertedToTicketId={convertedToTicketId}
          editHref={editHref}
          canWrite={canWrite}
          canInvoice={canInvoice}
          isMutable={isMutable}
          mutating={mutating}
          sharing={phase === 'sharing'}
          downloading={phase === 'downloading'}
          duplicating={duplicating}
          onShare={() => void handleShare()}
          onDownload={() => void handleDownload()}
          onConvert={() => setConfirm('convert')}
          onCancel={() => setConfirm('cancel')}
          onDuplicate={() => void handleDuplicate()}
        />
        {confirmSheet}
      </>
    );
  }

  return (
    <>
      <TripledDashboardShell maxWidthClassName="max-w-2xl" contentClassName="space-y-4">
        <TripledMobileAppBar
          title={`Presupuesto #${presupuestoId}`}
          subtitle="Guardado"
          backHref="/presupuestos"
          backLabel="Volver a presupuestos"
        />

        <BlurFade>
          <ReviewSuccessHeader
            title={title}
            subtitle={[clientName, dateLabel].filter(Boolean).join(' · ')}
          />
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
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cliente
                </dt>
                <dd className="mt-0.5 font-medium [overflow-wrap:anywhere]">
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
              <p
                className="mt-3 whitespace-pre-line border-t border-border/60 pt-3 text-sm text-muted-foreground [overflow-wrap:anywhere]"
                data-testid="presupuesto-notes"
              >
                {collapseBlankLines(workNotes)}
              </p>
            ) : null}
          </section>
        </BlurFade>

        <BlurFade delay={0.1}>
          {/* Listo shares the compact Resumen with the ticket listo (ZIG-I13-3). */}
          <ReviewSummaryCard
            lines={lines}
            total={total}
            linesLabel="Servicios del presupuesto"
          />
        </BlurFade>

        <BlurFade delay={0.15}>
          <section aria-labelledby="presupuesto-pdf-heading" className={REVIEW_SECTION_CLASS}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="presupuesto-pdf-heading" className="text-base font-semibold">
                Presupuesto en PDF
              </h2>
              {canInvoice ? (
                <Link
                  href={`/presupuestos/${presupuestoId}/pdf`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Abrir PDF
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : null}
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

        <div className="hidden items-center justify-between gap-4 md:flex">
          <Link
            href={`/presupuestos/${presupuestoId}`}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Ver presupuesto
          </Link>
          {shareCta}
        </div>

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

      {confirmSheet}
    </>
  );
};
