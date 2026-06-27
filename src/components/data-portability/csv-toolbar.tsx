'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseCsvRecords, toCsv } from '@/lib/csv';

type CsvRecord = Record<string, string>;

type ExportResult = {
  success: boolean;
  data?: CsvRecord[];
  error?: string;
};

type ImportResult = {
  success: boolean;
  data?: { inserted: number; failed: number; errors: string[] };
  error?: string;
};

interface CsvToolbarProps {
  headers: readonly string[];
  filename: string;
  exportAction: () => Promise<ExportResult>;
  importAction?: (records: CsvRecord[]) => Promise<ImportResult>;
}

export const CsvToolbar = ({
  headers,
  filename,
  exportAction,
  importAction,
}: CsvToolbarProps) => {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const result = await exportAction();
      if (!result.success || !result.data) {
        toast.error(result.error || 'No se pudo exportar');
        return;
      }
      const csv = toCsv([...headers], result.data);
      const blob = new Blob([`\ufeff${csv}`], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${result.data.length} registros exportados`);
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !importAction) {
      return;
    }

    setBusy(true);
    try {
      const text = await file.text();
      const records = parseCsvRecords(text);
      if (records.length === 0) {
        toast.error('El archivo no contiene filas de datos');
        return;
      }

      const result = await importAction(records);
      if (!result.success || !result.data) {
        toast.error(result.error || 'No se pudo importar el archivo');
        return;
      }

      const { inserted, failed, errors } = result.data;
      if (inserted > 0) {
        toast.success(`${inserted} registros importados`);
      }
      if (failed > 0 || errors.length > 0) {
        toast.warning(
          `${failed} filas con errores. ${errors.slice(0, 3).join(' · ')}`,
        );
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handleExport}
        disabled={busy}
      >
        <Download className="size-4" aria-hidden />
        Exportar CSV
      </Button>

      {importAction ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <Upload className="size-4" aria-hidden />
            Importar CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
            aria-hidden
          />
        </>
      ) : null}
    </div>
  );
};
