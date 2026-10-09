import { buildTicketInvoiceDownloadUrl } from '@/lib/ticket-invoice-url';

export const PDF_DOWNLOAD_TIMEOUT_MS = 60_000;

type TicketInvoiceDeliveryResult = 'downloaded' | 'shared' | 'dismissed';

type TicketInvoiceDeliveryOptions = {
  ticketId: string | number | bigint;
  downloadFileName: string;
  companyId?: number | null;
  /** download skips the share sheet (explicit Descargar PDF). */
  mode?: 'share-or-download' | 'download';
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

const canShareFile = (file: File): boolean =>
  typeof navigator !== 'undefined' &&
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [file] });

const downloadBlob = (blob: Blob, downloadFileName: string) => {
  const pdfUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = pdfUrl;
  downloadLink.download = downloadFileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(pdfUrl);
};

const offerFileShare = async (
  file: File,
  downloadFileName: string,
): Promise<boolean> => {
  if (!canShareFile(file) || typeof navigator.share !== 'function') {
    return false;
  }

  try {
    await navigator.share({
      files: [file],
      title: 'Compartir PDF',
      text: downloadFileName,
    });
    return true;
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    return false;
  }
};

/** Fetch the ticket PDF as a File (for the Web Share API or a later tap). */
export const fetchTicketInvoiceFile = async ({
  ticketId,
  downloadFileName,
  companyId,
}: Omit<TicketInvoiceDeliveryOptions, 'mode'>): Promise<File> => {
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(
    () => abortController.abort(),
    PDF_DOWNLOAD_TIMEOUT_MS,
  );
  try {
    const response = await fetch(buildTicketInvoiceDownloadUrl(ticketId, companyId), {
      cache: 'no-store',
      signal: abortController.signal,
    });
    if (!response.ok) {
      throw new Error(`PDF request failed with status ${response.status}`);
    }
    const pdf = await response.blob();
    return new File([pdf], downloadFileName, {
      type: pdf.type || 'application/pdf',
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export type TicketInvoiceShareResult =
  | 'shared'
  | 'dismissed'
  | 'unsupported'
  | 'needs-gesture';

/**
 * Open the native share sheet with the PDF file. `needs-gesture` means the
 * browser refused because the tap that started the flow is too old (e.g. after
 * finishing the ticket); ask the user to tap Compartir again.
 */
export const shareTicketInvoiceFile = async (
  file: File,
  { title, text }: { title: string; text?: string },
): Promise<TicketInvoiceShareResult> => {
  if (!canShareFile(file) || typeof navigator.share !== 'function') {
    return 'unsupported';
  }
  try {
    await navigator.share({ files: [file], title, text });
    return 'shared';
  } catch (error) {
    if (isAbortError(error)) return 'dismissed';
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return 'needs-gesture';
    }
    return 'unsupported';
  }
};

/** Save a fetched PDF file through a temporary download link. */
export const downloadTicketInvoiceFile = (file: File) => {
  downloadBlob(file, file.name);
};

export const fetchAndDeliverTicketInvoice = async ({
  ticketId,
  downloadFileName,
  companyId,
  mode = 'share-or-download',
}: TicketInvoiceDeliveryOptions): Promise<TicketInvoiceDeliveryResult> => {
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(
    () => abortController.abort(),
    PDF_DOWNLOAD_TIMEOUT_MS,
  );

  try {
    const response = await fetch(buildTicketInvoiceDownloadUrl(ticketId, companyId), {
      cache: 'no-store',
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`PDF request failed with status ${response.status}`);
    }

    const pdf = await response.blob();
    const file = new File([pdf], downloadFileName, {
      type: pdf.type || 'application/pdf',
    });

    if (mode === 'share-or-download') {
      try {
        if (await offerFileShare(file, downloadFileName)) {
          return 'shared';
        }
      } catch (error) {
        if (isAbortError(error)) {
          return 'dismissed';
        }
        throw error;
      }
    }

    downloadBlob(pdf, downloadFileName);
    return 'downloaded';
  } finally {
    window.clearTimeout(timeoutId);
  }
};
