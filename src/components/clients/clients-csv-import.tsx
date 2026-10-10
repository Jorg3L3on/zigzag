'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { presentActionError } from '@/lib/network-awareness';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { parseCsvRecords } from '@/lib/csv';
import { bulkImportClients } from '@/actions/clients';
import { useCompany } from '@/contexts/company-context';

type ClientsCsvImportProps = {
  companyId?: number | null;
};

type ImportFormValues = {
  file: string;
};

/**
 * Clients CSV import with FormMessage field-error UI bound to
 * `bulkImportClients` validation failures. Render it only for users with
 * `clients.write`.
 */
export const ClientsCsvImport = ({
  companyId: companyIdProp,
}: ClientsCsvImportProps) => {
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const companyId = companyIdProp ?? selectedCompany?.id ?? null;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputId = React.useId();
  const [busy, setBusy] = React.useState(false);
  const form = useForm<ImportFormValues>({
    defaultValues: { file: '' },
  });

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
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

      const result = await bulkImportClients(records, companyId);
      if (!result.success || !result.data) {
        const message = result.error || 'No se pudo importar el archivo';
        form.setError('file', { message });
        const content = presentActionError(result, message);
        toast.error(content.title, { description: content.description });
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
                <Upload className="size-4" aria-hidden data-icon="inline-start" />
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
    </Form>
  );
};
