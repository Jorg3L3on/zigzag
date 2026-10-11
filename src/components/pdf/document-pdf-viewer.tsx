'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { PDFDownloadButton } from '@/components/pdf-download-button';
import { usePdfViewerEnabled } from '@/components/tickets/review/document-review-parts';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledMobileStickyActionBar,
} from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import {
  downloadTicketInvoiceFile,
  fetchTicketInvoiceFile,
  shareTicketInvoiceFile,
} from '@/lib/ticket-invoice-download';
import { buildTicketInvoicePreviewUrl } from '@/lib/ticket-invoice-url';
import { canDownloadTicketInvoice } from '@/lib/tickets-rbac';
import {
  buildWhatsAppQuoteShare,
  buildWhatsAppReceiptShare,
} from '@/lib/whatsapp-share';

export type DocumentPdfWhatsApp =
  | {
      kind: 'presupuesto';
      phone: string | null;
      clientName: string | null;
      total: number;
      servicesSummary: string;
      validUntil: string | null;
    }
  | {
      kind: 'recibo';
      phone: string | null;
      clientName: string | null;
      total: number;
      paid: number;
    };

export type DocumentPdfViewerProps = {
  /** Ticket row id: a presupuesto is a ticket with document_kind presupuesto. */
  ticketId: string;
  kind: 'presupuesto' | 'recibo';
  title: string;
  subtitle: string;
  backHref: string;
  backLabel: string;
  downloadFileName: string;
  /** HTML stand-in rendered where the browser cannot show the PDF inline. */
  summary: React.ReactNode;
  /** Data for the WhatsApp text used when the share sheet is unavailable. */
  whatsApp: DocumentPdfWhatsApp;
};

const FALLBACK_HINT = 'Tu navegador no muestra PDF aquí; descárgalo o compártelo.';

/**
 * In-app PDF viewer (ZIG-I9) for /presupuestos/[id]/pdf and /tickets/[id]/recibo.
 * Keeps the standard app bar (back arrow) and the dock, so opening the PDF never
 * leaves the PWA shell. Where the browser cannot render PDFs inline (Android
 * Chrome) it shows the summary with Descargar PDF / Compartir instead.
 */
export const DocumentPdfViewer = ({
  ticketId,
  kind,
  title,
  subtitle,
  backHref,
  backLabel,
  downloadFileName,
  summary,
  whatsApp,
}: DocumentPdfViewerProps) => {
  const { can } = usePermissions();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const canInvoice = canDownloadTicketInvoice(can);
  const pdfViewerEnabled = usePdfViewerEnabled();
  const noun = kind === 'presupuesto' ? 'presupuesto' : 'recibo';

  const [sharing, setSharing] = React.useState(false);

  const openWhatsAppFallback = (): boolean => {
    const share =
      whatsApp.kind === 'presupuesto'
        ? buildWhatsAppQuoteShare({
            phone: whatsApp.phone,
            clientName: whatsApp.clientName,
            ticketId,
            total: whatsApp.total,
            servicesSummary: whatsApp.servicesSummary,
            validUntil: whatsApp.validUntil,
            companyName: selectedCompany?.name,
          })
        : buildWhatsAppReceiptShare({
            phone: whatsApp.phone,
            clientName: whatsApp.clientName,
            ticketId,
            total: whatsApp.total,
            paid: whatsApp.paid,
            companyName: selectedCompany?.name,
          });
    if (!share) return false;
    window.open(share.href, '_blank', 'noopener,noreferrer');
    return true;
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const file = await fetchTicketInvoiceFile({ ticketId, downloadFileName, companyId });
      const result = await shareTicketInvoiceFile(file, {
        title,
        text: whatsApp.clientName
          ? `${kind === 'presupuesto' ? 'Presupuesto para' : 'Recibo de'} ${whatsApp.clientName}`
          : undefined,
      });
      if (result === 'shared') {
        toast.success(`${kind === 'presupuesto' ? 'Presupuesto' : 'Recibo'} compartido`);
      } else if (result === 'needs-gesture') {
        toast.message(`${kind === 'presupuesto' ? 'Presupuesto' : 'Recibo'} listo`, {
          description: 'Toca Compartir para enviarlo.',
        });
      } else if (result === 'unsupported') {
        if (openWhatsAppFallback()) {
          toast.success(`Abrimos WhatsApp con el resumen del ${noun}`);
        } else {
          downloadTicketInvoiceFile(file);
          toast.success('PDF descargado');
        }
      }
    } catch {
      toast.error(`No se pudo preparar el ${noun}`);
    } finally {
      setSharing(false);
    }
  };

  const downloadButton = (className: string) => (
    <PDFDownloadButton
      ticketId={ticketId}
      downloadFileName={downloadFileName}
      companyId={companyId}
      label="Descargar PDF"
      className={className}
    />
  );

  const shareButton = (className: string) => (
    <Button
      type="button"
      className={className}
      disabled={sharing}
      onClick={() => void handleShare()}
    >
      {sharing ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Share2 className="h-4 w-4" aria-hidden />
      )}
      {sharing ? 'Preparando…' : 'Compartir'}
    </Button>
  );

  const embed = canInvoice && pdfViewerEnabled;

  return (
    <>
      <TripledDashboardShell maxWidthClassName="max-w-3xl" contentClassName="space-y-3">
        <TripledMobileAppBar
          title={title}
          subtitle={subtitle}
          backHref={backHref}
          backLabel={backLabel}
        />

        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-full">
            <Link href={backHref} aria-label={backLabel}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        {embed ? (
          <>
            <div className="flex gap-2" data-testid="pdf-viewer-actions">
              {downloadButton('h-10 flex-1 rounded-xl md:flex-none')}
              {shareButton('h-10 flex-1 rounded-xl md:flex-none')}
            </div>
            <object
              data={buildTicketInvoicePreviewUrl(ticketId, companyId)}
              type="application/pdf"
              aria-label={`Vista del ${noun} ${ticketId}`}
              data-testid="pdf-viewer-embed"
              className="h-[calc(100dvh-4.25rem-var(--dock-clearance)-3.5rem)] min-h-[320px] w-full rounded-xl border border-border/60 bg-muted/20 md:h-[calc(100dvh-10rem)] md:min-h-[480px]"
            >
              {summary}
            </object>
          </>
        ) : (
          <>
            {summary}
            {canInvoice ? (
              <p className="px-1 text-xs text-muted-foreground" data-testid="pdf-viewer-hint">
                {FALLBACK_HINT}
              </p>
            ) : null}
            {canInvoice ? (
              <div className="hidden gap-2 md:flex" data-testid="pdf-viewer-actions">
                {downloadButton('h-11 rounded-xl')}
                {shareButton('h-11 rounded-xl')}
              </div>
            ) : null}
          </>
        )}
      </TripledDashboardShell>

      {!embed && canInvoice ? (
        <TripledMobileStickyActionBar>
          <div className="flex min-w-0 flex-1 gap-2" data-testid="pdf-viewer-sticky-actions">
            {downloadButton('h-12 flex-1 rounded-xl')}
            {shareButton('h-12 flex-1 rounded-xl')}
          </div>
        </TripledMobileStickyActionBar>
      ) : null}
    </>
  );
};
