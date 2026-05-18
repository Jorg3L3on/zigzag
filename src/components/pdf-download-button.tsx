'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildTicketInvoiceDownloadUrl } from '@/lib/ticket-invoice-url';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleDownload}
            disabled={isGenerating}
            aria-label="Descargar PDF"
            className={cn(
              'shrink-0 border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:bg-background',
              className,
            )}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4 shrink-0" aria-hidden />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Descargar PDF</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
