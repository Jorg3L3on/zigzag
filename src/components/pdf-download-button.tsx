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

const PDF_DOWNLOAD_TIMEOUT_MS = 60_000;

interface PDFDownloadButtonProps {
  ticketId: string | number | bigint;
  downloadFileName: string;
  companyId?: number | null;
  className?: string;
  /** When set, render a labeled button instead of the icon-only control. */
  label?: string;
  variant?: 'outline' | 'default' | 'secondary' | 'ghost';
}

export function PDFDownloadButton({
  ticketId,
  downloadFileName,
  companyId,
  className,
  label,
  variant = 'outline',
}: PDFDownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(
      () => abortController.abort(),
      PDF_DOWNLOAD_TIMEOUT_MS,
    );

    try {
      setIsGenerating(true);
      const response = await fetch(buildTicketInvoiceDownloadUrl(ticketId, companyId), {
        cache: 'no-store',
        signal: abortController.signal,
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
      window.clearTimeout(timeoutId);
      setIsGenerating(false);
    }
  };

  const ariaLabel = label ?? 'Descargar PDF';

  if (label) {
    return (
      <Button
        type="button"
        variant={variant}
        onClick={handleDownload}
        disabled={isGenerating}
        aria-label={ariaLabel}
        className={cn('h-10 gap-2', className)}
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Download className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span>{isGenerating ? 'Generando…' : label}</span>
      </Button>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant={variant}
            onClick={handleDownload}
            disabled={isGenerating}
            aria-label={ariaLabel}
            className={cn(
              'shrink-0 border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:bg-background',
              className,
            )}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden data-icon="inline-start"/>
            ) : (
              <Download className="h-4 w-4 shrink-0" aria-hidden  data-icon="inline-start" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Descargar PDF</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
