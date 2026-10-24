'use client';

import * as React from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';

import { DocumentPdfEmbed } from '@/components/pdf/document-pdf-embed';
import { PDFDownloadButton } from '@/components/pdf-download-button';
import { usePdfViewerEnabled } from '@/components/tickets/review/document-review-parts';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/contexts/company-context';
import { useIsDesktop } from '@/hooks/use-desktop';
import { usePermissions } from '@/hooks/use-permissions';
import { canDownloadTicketInvoice } from '@/lib/tickets-rbac';
import { cn } from '@/lib/utils';

export type DocumentPdfAsideProps = {
  ticketId: string;
  kind: 'presupuesto' | 'recibo';
  /** In-app viewer page (/presupuestos/[id]/pdf, /tickets/[id]/recibo). */
  viewerHref: string;
  downloadFileName: string;
  /**
   * Changes whenever what the PDF prints changes (total, payments, lines), so
   * the preview reloads after an edit or a payment instead of showing the old file.
   */
  version: string;
  /** Actions shown above the PDF (Editar, Duplicar…), so nothing hides behind ⋯. */
  actions?: React.ReactNode;
  className?: string;
};

/**
 * Desktop detail aside (ZIG-I24-3): the document's PDF next to the detail, with
 * Abrir and Descargar always in view. Renders nothing below 1024px (phones keep
 * their layout and never load the PDF here). Where the browser cannot show a PDF
 * inline (headless, some Linux builds) it keeps the buttons and says so.
 */
export const DocumentPdfAside = ({
  ticketId,
  kind,
  viewerHref,
  downloadFileName,
  version,
  actions,
  className,
}: DocumentPdfAsideProps) => {
  const isDesktop = useIsDesktop();
  const pdfViewerEnabled = usePdfViewerEnabled();
  const { can } = usePermissions();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const canInvoice = canDownloadTicketInvoice(can);
  const noun = kind === 'presupuesto' ? 'presupuesto' : 'recibo';
  const headingId = `document-pdf-aside-${ticketId}`;

  if (!isDesktop) return null;

  return (
    <section
      aria-labelledby={headingId}
      data-testid="document-pdf-aside"
      className={cn('flex min-w-0 flex-col gap-3', className)}
    >
      {actions ? (
        <div className="flex flex-wrap gap-2" data-testid="document-pdf-aside-actions">
          {actions}
        </div>
      ) : null}
      {canInvoice ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 id={headingId} className="text-[15px] font-semibold">
              {kind === 'presupuesto' ? 'PDF del presupuesto' : 'PDF del recibo'}
            </h2>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button asChild variant="ghost" className="h-9 gap-1.5 px-2.5 text-sm">
                <Link href={viewerHref}>
                  <FileText className="h-4 w-4" aria-hidden />
                  Abrir
                </Link>
              </Button>
              <PDFDownloadButton
                ticketId={ticketId}
                downloadFileName={downloadFileName}
                companyId={companyId}
                label="Descargar"
                variant="ghost"
                className="h-9 px-2.5 text-sm"
              />
            </div>
          </div>
          {pdfViewerEnabled ? (
            <DocumentPdfEmbed
              key={version}
              ticketId={ticketId}
              companyId={companyId}
              noun={noun}
              className="h-[calc(100dvh-12rem)] min-h-[480px] bg-background"
            />
          ) : (
            <p
              className="rounded-xl border border-dashed border-border/70 bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground"
              data-testid="document-pdf-aside-fallback"
            >
              Este navegador no muestra el PDF aquí. Ábrelo o descárgalo.
            </p>
          )}
        </>
      ) : (
        <h2 id={headingId} className="sr-only">
          Acciones
        </h2>
      )}
    </section>
  );
};
