import { buildTicketInvoicePreviewUrl } from '@/lib/ticket-invoice-url';
import { cn } from '@/lib/utils';

type DocumentPdfEmbedProps = {
  ticketId: string;
  companyId: number | null;
  /** "presupuesto" or "recibo", for the accessible name. */
  noun: string;
  className?: string;
};

/**
 * The inline PDF itself, shared by the viewer page and the desktop detail
 * asides (ZIG-I24-3). A same-origin iframe, not an <object>: the app CSP has
 * `object-src 'none'`, which blocked the plugin and left a blank box. The
 * invoice route allows framing by our own pages only (next.config.ts).
 * Callers check usePdfViewerEnabled first and show their own fallback.
 */
export const DocumentPdfEmbed = ({ ticketId, companyId, noun, className }: DocumentPdfEmbedProps) => (
  <iframe
    src={buildTicketInvoicePreviewUrl(ticketId, companyId)}
    title={`Vista del ${noun} ${ticketId}`}
    data-testid="pdf-viewer-embed"
    className={cn('w-full rounded-xl border border-border/60 bg-muted/20', className)}
  />
);
