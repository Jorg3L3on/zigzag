'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileText, Loader2 } from 'lucide-react';
import InvoiceTemplate from '@/components/pdf/invoice-template';
import { renderElementToPdfBlob } from '@/lib/pdf-export';
import type { InvoiceData } from '@/components/pdf/invoice-types';
import { toast } from 'sonner';

interface PDFDownloadButtonProps {
  invoiceData: InvoiceData;
  downloadFileName: string;
  className?: string;
}

export function PDFDownloadButton({
  invoiceData,
  downloadFileName,
  className,
}: PDFDownloadButtonProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    if (!pdfRef.current) {
      toast.error('No se pudo preparar el PDF');
      return;
    }

    try {
      setIsGenerating(true);
      const pdf = await renderElementToPdfBlob(pdfRef.current);
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
      toast.error('No se pudo generar el PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div
        className="pointer-events-none absolute left-0 -top-[12000px] z-[-1] overflow-visible bg-white"
        aria-hidden
      >
        <div ref={pdfRef} className="bg-white">
          <InvoiceTemplate data={invoiceData} />
        </div>
      </div>
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
    </>
  );
}
