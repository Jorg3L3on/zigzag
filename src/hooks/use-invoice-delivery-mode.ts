import { useIsDesktop } from '@/hooks/use-desktop';

export type InvoiceDeliveryMode = 'share-or-download' | 'download';

/**
 * How a «Descargar» control hands over the PDF (ZIG-I37-2): from 1024 px it saves
 * the file, because the label says Descargar; on phones it keeps offering the
 * share sheet first, where saving a file is awkward.
 */
export const useInvoiceDeliveryMode = (): InvoiceDeliveryMode =>
  useIsDesktop() ? 'download' : 'share-or-download';
