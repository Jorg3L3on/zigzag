'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { presentActionError } from '@/lib/network-awareness';
import { fetchAndDeliverTicketInvoice } from '@/lib/ticket-invoice-download';
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
    try {
      setIsGenerating(true);
      const result = await fetchAndDeliverTicketInvoice({
        ticketId,
        companyId,
        downloadFileName,
      });

      if (result === 'shared') {
        toast.success('PDF compartido correctamente');
      } else if (result === 'downloaded') {
        toast.success('PDF descargado correctamente');
      }
    } catch (error) {
      console.error('Error generating ticket PDF:', error);
      const isTimeout =
        error instanceof DOMException && error.name === 'AbortError';
      const content = presentActionError(
        isTimeout ? { errorCode: 'PDF001' } : null,
        'No se pudo generar el PDF',
        isTimeout ? 'server' : undefined,
      );
      toast.error(content.title, { description: content.description });
    } finally {
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
              'shrink-0 border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-800 dark:bg-background dark:text-blue-300 dark:hover:bg-blue-950/40 dark:hover:text-blue-200',
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
