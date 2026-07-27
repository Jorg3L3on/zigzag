'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { CsvImportCommitSummary } from '@/lib/csv-import-types';
import { toCsv } from '@/lib/csv';

type CsvImportResultsProps = {
  summary: CsvImportCommitSummary;
  onViewCatalog: () => void;
  onImportAnother: () => void;
};

export const CsvImportResults = ({
  summary,
  onViewCatalog,
  onImportAnother,
}: CsvImportResultsProps) => {
  const handleDownloadReport = () => {
    if (summary.reportRows.length === 0) {
      return;
    }
    const csv = toCsv(
      ['fila', 'estado', 'nombre', 'motivo'],
      summary.reportRows.map((row) => ({
        fila: String(row.rowNumber || ''),
        estado: row.status,
        nombre: row.name ?? '',
        motivo: row.reason,
      })),
    );
    const blob = new Blob([`\ufeff${csv}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'servicios-import-errores.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" data-testid="csv-import-results">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Resultado de la importación</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary.stopped
            ? `La importación se detuvo. ${summary.stopReason ?? ''}`.trim()
            : 'La importación terminó.'}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <dt className="text-xs text-muted-foreground">Insertados</dt>
          <dd className="text-2xl font-semibold tabular-nums text-foreground">
            {summary.inserted}
          </dd>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <dt className="text-xs text-muted-foreground">Omitidos</dt>
          <dd className="text-2xl font-semibold tabular-nums text-foreground">
            {summary.skipped}
          </dd>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <dt className="text-xs text-muted-foreground">Fallidos</dt>
          <dd className="text-2xl font-semibold tabular-nums text-foreground">
            {summary.failed}
          </dd>
        </div>
      </dl>

      {summary.errors.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
          {summary.errors.slice(0, 20).map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" onClick={onViewCatalog}>
          Ver catálogo
        </Button>
        <Button type="button" variant="outline" onClick={onImportAnother}>
          Importar otro archivo
        </Button>
        {summary.reportRows.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={handleDownloadReport}
          >
            <Download className="size-4" aria-hidden data-icon="inline-start" />
            Descargar errores/omitidos
          </Button>
        ) : null}
      </div>
    </div>
  );
};
