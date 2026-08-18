'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CsvImportProgress } from '@/components/data-portability/csv-import-progress';
import { CsvImportResults } from '@/components/data-portability/csv-import-results';
import {
  commitServiceCsvImportChunk,
  previewServiceCsvImport,
  type ServiceCsvCommitRow,
} from '@/actions/services';
import { parseCsvRecords } from '@/lib/csv';
import { runChunkedImport } from '@/lib/csv-chunk-runner';
import {
  emptyCsvImportCommitSummary,
  mergeCsvImportCommitSummaries,
  type CsvImportCommitSummary,
} from '@/lib/csv-import-types';
import { buildServiceCsvPlantilla } from '@/lib/service-csv';
import type { ServiceCsvPreviewResult } from '@/lib/service-csv-preview';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { presentActionError } from '@/lib/network-awareness';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { SystemCompanyContextEmptyState } from '@/components/system-company-context-empty-state';

type Step = 'upload' | 'preview' | 'importing' | 'results';

export const ServicesCsvImportClient = () => {
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const missingCompany = needsSelectedCompanyContext(
    permissions.isSystem,
    selectedCompany?.id,
  );

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputId = React.useId();
  const [step, setStep] = React.useState<Step>('upload');
  const [busy, setBusy] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<ServiceCsvPreviewResult | null>(
    null,
  );
  const [progress, setProgress] = React.useState({
    processedItems: 0,
    totalItems: 0,
  });
  const [results, setResults] = React.useState<CsvImportCommitSummary | null>(
    null,
  );

  const handleReset = () => {
    setStep('upload');
    setBusy(false);
    setFileError(null);
    setPreview(null);
    setProgress({ processedItems: 0, totalItems: 0 });
    setResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadPlantilla = () => {
    const csv = buildServiceCsvPlantilla();
    const blob = new Blob([`\ufeff${csv}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla-servicios.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setBusy(true);
    setFileError(null);
    setPreview(null);
    try {
      const text = await file.text();
      const records = parseCsvRecords(text);
      const result = await previewServiceCsvImport(
        records,
        selectedCompany?.id ?? null,
      );
      if (!result.success || !result.data) {
        const message = result.error || 'No se pudo validar el archivo';
        setFileError(message);
        const content = presentActionError(result, message);
        toast.error(content.title, { description: content.description });
        setStep('upload');
        return;
      }
      setPreview(result.data);
      setStep('preview');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo leer el archivo';
      setFileError(message);
      toast.error(message);
      setStep('upload');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) {
      return;
    }

    const okRows: ServiceCsvCommitRow[] = preview.rows
      .filter((row) => row.status === 'ok')
      .map((row) => ({
        name: row.name!,
        description: row.description!,
        price: row.price!,
      }));

    if (okRows.length === 0) {
      const summary: CsvImportCommitSummary = {
        ...emptyCsvImportCommitSummary(),
        skipped: preview.summary.skipped,
        failed: preview.summary.failed,
        errors: preview.rows
          .filter((row) => row.status !== 'ok')
          .map((row) => `Fila ${row.rowNumber}: ${row.reason ?? row.status}`),
        reportRows: preview.rows
          .filter(
            (row): row is typeof row & { status: 'skip' | 'error' } =>
              row.status === 'skip' || row.status === 'error',
          )
          .map((row) => ({
            rowNumber: row.rowNumber,
            status: row.status,
            reason: row.reason ?? row.status,
            name: row.name,
          })),
      };
      setResults(summary);
      setStep('results');
      return;
    }

    setStep('importing');
    setBusy(true);
    setProgress({ processedItems: 0, totalItems: okRows.length });

    const runner = await runChunkedImport({
      items: okRows,
      runChunk: async (chunk) => {
        const result = await commitServiceCsvImportChunk(
          chunk,
          selectedCompany?.id ?? null,
        );
        if (!result.success || !result.data) {
          return {
            ok: false as const,
            error: result.error || 'No se pudo importar el bloque',
          };
        }
        return { ok: true as const, result: result.data };
      },
      onProgress: (p) =>
        setProgress({
          processedItems: p.processedItems,
          totalItems: p.totalItems,
        }),
    });

    const merged = mergeCsvImportCommitSummaries(runner.chunkResults);
    const previewSkipsErrors: CsvImportCommitSummary = {
      ...emptyCsvImportCommitSummary(),
      skipped: preview.summary.skipped,
      failed: preview.summary.failed,
      errors: preview.rows
        .filter((row) => row.status !== 'ok')
        .map((row) => `Fila ${row.rowNumber}: ${row.reason ?? row.status}`),
      reportRows: preview.rows
        .filter(
          (row): row is typeof row & { status: 'skip' | 'error' } =>
            row.status === 'skip' || row.status === 'error',
        )
        .map((row) => ({
          rowNumber: row.rowNumber,
          status: row.status,
          reason: row.reason ?? row.status,
          name: row.name,
        })),
    };

    const finalSummary = mergeCsvImportCommitSummaries([
      previewSkipsErrors,
      merged,
    ]);

    if (runner.stopped) {
      finalSummary.stopped = true;
      finalSummary.stopReason =
        runner.error || 'La importación se detuvo por un error de red o servidor';
      toast.warning('La importación se detuvo antes de terminar');
    } else {
      toast.success(
        `${finalSummary.inserted} servicios importados` +
          (finalSummary.skipped ? `, ${finalSummary.skipped} omitidos` : ''),
      );
    }

    setResults(finalSummary);
    setStep('results');
    setBusy(false);
  };

  if (missingCompany) {
    return <SystemCompanyContextEmptyState resourceLabel="servicios" />;
  }

  return (
    <div className="space-y-6">
      {step === 'upload' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Descarga la plantilla, completa hasta 500 filas y súbela para
            revisar el resultado antes de guardar. Encabezados:{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              nombre,descripción,precio
            </code>
            . También se aceptan alias en inglés.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={handleDownloadPlantilla}
            >
              <Download className="size-4" aria-hidden data-icon="inline-start" />
              Descargar plantilla
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" aria-hidden data-icon="inline-start" />
              {busy ? 'Validando…' : 'Elegir archivo CSV'}
            </Button>
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleFileChange}
              aria-label="Archivo CSV para importar servicios"
            />
            <Button type="button" variant="ghost" asChild>
              <Link href="/services">Cancelar</Link>
            </Button>
          </div>
          {fileError ? (
            <p className="text-sm text-destructive" role="alert">
              {fileError}
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 'preview' && preview ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Vista previa</h2>
            <p className="text-sm text-muted-foreground">
              {preview.summary.ok} listos · {preview.summary.skipped} omitidos ·{' '}
              {preview.summary.failed} con error. Nada se ha guardado todavía.
            </p>
          </div>
          <div className="max-h-80 overflow-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fila</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => (
                  <TableRow key={row.rowNumber}>
                    <TableCell className="tabular-nums">{row.rowNumber}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.reason ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              disabled={busy || preview.summary.ok === 0}
              onClick={() => void handleConfirmImport()}
            >
              Confirmar importación ({preview.summary.ok})
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              Elegir otro archivo
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'importing' ? (
        <CsvImportProgress
          processedItems={progress.processedItems}
          totalItems={progress.totalItems}
        />
      ) : null}

      {step === 'results' && results ? (
        <CsvImportResults
          summary={results}
          onViewCatalog={() => router.push('/services?imported=1')}
          onImportAnother={handleReset}
        />
      ) : null}
    </div>
  );
};
