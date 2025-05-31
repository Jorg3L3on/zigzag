'use client';

import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

interface PDFDownloadButtonProps {
  ticketId: number;
}

export function PDFDownloadButton({ ticketId }: PDFDownloadButtonProps) {
  return (
    <Button
      onClick={() => {
        window.open(`/api/tickets/${ticketId}/pdf`, '_blank');
      }}
      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
    >
      <FileText className="mr-2 h-4 w-4" />
      Descargar PDF
    </Button>
  );
}
