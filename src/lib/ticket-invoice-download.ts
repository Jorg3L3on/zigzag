import { buildTicketInvoiceDownloadUrl } from '@/lib/ticket-invoice-url';

export const PDF_DOWNLOAD_TIMEOUT_MS = 60_000;

type TicketInvoiceDeliveryResult = 'downloaded' | 'shared' | 'dismissed';

type TicketInvoiceDeliveryOptions = {
  ticketId: string | number | bigint;
  downloadFileName: string;
  companyId?: number | null;
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

export const fetchAndDeliverTicketInvoice = async ({
  ticketId,
  downloadFileName,
  companyId,
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

    downloadBlob(pdf, downloadFileName);
    return 'downloaded';
  } finally {
    window.clearTimeout(timeoutId);
  }
};
