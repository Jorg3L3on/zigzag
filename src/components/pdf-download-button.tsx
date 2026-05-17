'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildTicketInvoiceDownloadUrl } from '@/lib/ticket-invoice-url';

interface PDFDownloadButtonProps {
  ticketId: string | number | bigint;
  downloadFileName: string;
  companyId?: number | null;
  className?: string;
}

export function PDFDownloadButton({
  ticketId,
  downloadFileName,
  companyId,
  className,
}: PDFDownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      const response = await fetch(buildTicketInvoiceDownloadUrl(ticketId, companyId), {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`PDF request failed with status ${response.status}`);
      }

      const pdf = await response.blob();
      const pdfUrl = URL.createObjectURL(pdf);
      const downloadLink = document.createElement('a');
      downloadLink.href = pdfUrl;
      downloadLink.download = downloadFileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(pdfUrl);
      toast.success('PDF descargado correctamente');
    } catch (error) {
      console.error('Error generating ticket PDF:', error);
      toast.error('No se pudo generar el PDF. Código: PDF001');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleDownload}
      disabled={isGenerating}
      className={cn(
        'w-full min-w-0 max-w-full justify-center bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 sm:w-auto',
        className,
      )}
    >
      {isGenerating ? (
        <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <FileText className="mr-2 h-4 w-4 shrink-0" aria-hidden />
      )}
      Descargar PDF
    </Button>
  );
}
