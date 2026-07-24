'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { CLIENT_CSV_HEADERS } from '@/lib/csv-schemas';
import { parseCsvRecords, toCsv } from '@/lib/csv';
import { bulkImportClients, getClientsForExport } from '@/actions/clients';

type ClientsCsvToolbarProps = {
  canImport: boolean;
};

type ImportFormValues = {
  file: string;
};

/**
 * Clients CSV import/export with FormMessage field-error UI bound to
 * `bulkImportClients` validation failures.
 */
export const ClientsCsvToolbar = ({ canImport }: ClientsCsvToolbarProps) => {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputId = React.useId();
  const [busy, setBusy] = React.useState(false);
  const form = useForm<ImportFormValues>({
    defaultValues: { file: '' },
  });

  const handleExport = async () => {
    setBusy(true);
    try {
      const result = await getClientsForExport();
      if (!result.success || !result.data) {
        toast.error(result.error || 'No se pudo exportar');
        return;
      }
      const csv = toCsv([...CLIENT_CSV_HEADERS], result.data);
      const blob = new Blob([`\ufeff${csv}`], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'clientes.csv';
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
    if (!file || !canImport) {
      return;
    }

    setBusy(true);
    form.clearErrors('file');
    try {
      const text = await file.text();
      const records = parseCsvRecords(text);
      if (records.length === 0) {
        form.setError('file', {
          message: 'El archivo no contiene filas de datos',
        });
        toast.error('El archivo no contiene filas de datos');
        return;
      }

      const result = await bulkImportClients(records);
      if (!result.success || !result.data) {
        form.setError('file', {
          message: result.error || 'No se pudo importar el archivo',
        });
        toast.error(result.error || 'No se pudo importar el archivo');
        return;
      }

      const { inserted, failed, errors } = result.data;
      if (inserted > 0) {
        toast.success(`${inserted} registros importados`);
      }
      if (failed > 0 || errors.length > 0) {
        form.setError('file', {
          message: errors.join(' · ') || `${failed} filas con errores`,
        });
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
    <Form {...form}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            disabled={busy}
          >
            <Download className="size-4" aria-hidden  data-icon="inline-start" />
            Exportar CSV
          </Button>

          {canImport ? (
            <FormField
              control={form.control}
              name="file"
              render={() => (
                <FormItem className="space-y-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={busy}
                    >
                      <Upload className="size-4" aria-hidden  data-icon="inline-start" />
                      Importar CSV
                    </Button>
                    <FormControl>
                      <input
                        id={fileInputId}
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="sr-only"
                        onChange={handleFileChange}
                        aria-label="Archivo CSV para importar"
                      />
                    </FormControl>
                  </div>
                  <FormMessage data-testid="csv-import-field-errors" />
                </FormItem>
              )}
            />
          ) : null}
        </div>
      </div>
    </Form>
  );
};
