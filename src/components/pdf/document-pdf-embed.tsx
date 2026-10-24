import type * as React from 'react';

import { buildTicketInvoicePreviewUrl } from '@/lib/ticket-invoice-url';
import { cn } from '@/lib/utils';

type DocumentPdfEmbedProps = {
  ticketId: string;
  companyId: number | null;
  /** "presupuesto" or "recibo", for the accessible name. */
  noun: string;
  className?: string;
  /** Shown by browsers that cannot render the PDF inline. */
  children?: React.ReactNode;
};

/**
 * The inline PDF itself, shared by the viewer page and the desktop detail
 * asides (ZIG-I24-3). Callers check usePdfViewerEnabled first.
 */
export const DocumentPdfEmbed = ({
  ticketId,
  companyId,
  noun,
  className,
  children,
}: DocumentPdfEmbedProps) => (
  <object
    data={buildTicketInvoicePreviewUrl(ticketId, companyId)}
    type="application/pdf"
    aria-label={`Vista del ${noun} ${ticketId}`}
    data-testid="pdf-viewer-embed"
    className={cn('w-full rounded-xl border border-border/60 bg-muted/20', className)}
  >
    {children}
  </object>
);
