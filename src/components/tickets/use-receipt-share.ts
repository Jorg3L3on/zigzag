'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { recordReceiptShared } from '@/actions/tickets';
import { useCompany } from '@/contexts/company-context';
import { useCompanyPaymentInfo } from '@/hooks/use-company-payment-info';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import {
  downloadTicketInvoiceFile,
  fetchTicketInvoiceFile,
  shareTicketInvoiceFile,
} from '@/lib/ticket-invoice-download';
import { buildWhatsAppReceiptShare } from '@/lib/whatsapp-share';

type UseReceiptShareInput = {
  ticketId: string;
  folio?: string | null;
  downloadFileName: string;
  clientName: string | null;
  clientTel: string | null;
  total: number;
};

/**
 * Share or download a ticket's recibo (ZIG-I13-4): the share sheet with the PDF
 * where the browser has one, WhatsApp text next, a plain download last.
 */
export const useReceiptShare = ({
  ticketId,
  folio = null,
  downloadFileName,
  clientName,
  clientTel,
  total,
}: UseReceiptShareInput) => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const payment = useCompanyPaymentInfo();
  const [sharing, setSharing] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const fileRef = React.useRef<File | null>(null);

  const loadReceipt = React.useCallback(async (): Promise<File> => {
    if (fileRef.current) return fileRef.current;
    const file = await fetchTicketInvoiceFile({ ticketId, downloadFileName, companyId });
    fileRef.current = file;
    return file;
  }, [ticketId, downloadFileName, companyId]);

  /** The audit log remembers when the recibo went out (ZIG-I13-6); never blocks the share. */
  const logShared = React.useCallback(async () => {
    try {
      await recordReceiptShared?.(Number(ticketId), companyId);
    } catch {
      // The share already happened; the log is best effort.
    }
  }, [ticketId, companyId]);

  const share = React.useCallback(
    async (paidAmount: number) => {
      setSharing(true);
      try {
        const file = await loadReceipt();
        const result = await shareTicketInvoiceFile(file, {
          title: `Recibo ticket ${folio || `#${ticketId}`}`,
          text: clientName ? `Recibo de ${clientName}` : undefined,
        });
        if (result === 'shared') {
          void logShared();
          toast.success('Recibo compartido');
        } else if (result === 'needs-gesture') {
          toast.message('Recibo listo', {
            description: 'Toca Compartir recibo para enviarlo.',
          });
        } else if (result === 'unsupported') {
          const whatsApp = buildWhatsAppReceiptShare({
            phone: clientTel,
            clientName,
            ticketId,
            folio,
            total,
            paid: paidAmount,
            companyName: selectedCompany?.name,
            payment,
          });
          if (whatsApp) {
            void logShared();
            window.open(whatsApp.href, '_blank', 'noopener,noreferrer');
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
        setSharing(false);
      }
    },
    [loadReceipt, logShared, ticketId, folio, clientName, clientTel, total, selectedCompany?.name, payment],
  );

  const download = React.useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      downloadTicketInvoiceFile(await loadReceipt());
      toast.success('PDF descargado');
    } catch (error) {
      const errorType = classifyClientError(error);
      toast.error(getErrorMessageByType(errorType, 'No se pudo descargar el PDF'));
    } finally {
      setDownloading(false);
    }
  }, [downloading, loadReceipt]);

  return { share, download, sharing, downloading };
};
