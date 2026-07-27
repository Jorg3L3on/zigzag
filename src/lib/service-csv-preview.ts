import { z } from 'zod';
import {
  assertServiceCsvRowCount,
  normalizeServiceCsvRecord,
} from '@/lib/service-csv';
import {
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_DESCRIPTION_MAX_MESSAGE,
} from '@/lib/service-description';

export type ServiceCsvPreviewStatus = 'ok' | 'skip' | 'error';

export type ServiceCsvPreviewRow = {
  rowNumber: number;
  status: ServiceCsvPreviewStatus;
  reason?: string;
  name?: string;
  description?: string;
  price?: number;
};

export type ServiceCsvPreviewSummary = {
  ok: number;
  skipped: number;
  failed: number;
};

export type ServiceCsvPreviewResult = {
  rows: ServiceCsvPreviewRow[];
  summary: ServiceCsvPreviewSummary;
};

const previewRowSchema = z.object({
  name: z.string().trim().min(1, 'nombre requerido'),
  description: z
    .string()
    .trim()
    .min(1, 'descripción requerida')
    .max(SERVICE_DESCRIPTION_MAX_LENGTH, SERVICE_DESCRIPTION_MAX_MESSAGE),
  price: z.coerce
    .number({ error: 'precio inválido' })
    .nonnegative('precio inválido'),
});

const normalizeNameKey = (name: string): string => name.trim().toLowerCase();

/**
 * Pure dry-run classifier for Service CSV records given existing active names.
 * Does not write to the database.
 */
export const planServiceCsvImport = (
  records: Array<Record<string, string>>,
  activeNames: Iterable<string>,
):
  | { success: true; data: ServiceCsvPreviewResult }
  | { success: false; error: string } => {
  const rowCountCheck = assertServiceCsvRowCount(records.length);
  if (!rowCountCheck.ok) {
    return { success: false, error: rowCountCheck.error };
  }

  const activeNameSet = new Set(
    [...activeNames].map((name) => normalizeNameKey(name)).filter(Boolean),
  );
  const seenInFile = new Set<string>();

  const rows: ServiceCsvPreviewRow[] = [];
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (let index = 0; index < records.length; index += 1) {
    const rowNumber = index + 2;
    const normalized = normalizeServiceCsvRecord(records[index] ?? {});
    if (!normalized) {
      failed += 1;
      rows.push({
        rowNumber,
        status: 'error',
        reason: 'columnas nombre, descripción y precio requeridas',
      });
      continue;
    }

    const parsed = previewRowSchema.safeParse(normalized);
    if (!parsed.success) {
      failed += 1;
      const reason =
        parsed.error.issues.map((issue) => issue.message).join('; ') ||
        'datos inválidos';
      rows.push({
        rowNumber,
        status: 'error',
        reason,
        name: normalized.name,
        description: normalized.description,
      });
      continue;
    }

    const nameKey = normalizeNameKey(parsed.data.name);
    if (activeNameSet.has(nameKey) || seenInFile.has(nameKey)) {
      skipped += 1;
      rows.push({
        rowNumber,
        status: 'skip',
        reason: activeNameSet.has(nameKey)
          ? 'nombre duplicado (activo en catálogo)'
          : 'nombre duplicado (en el archivo)',
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
      });
      continue;
    }

    seenInFile.add(nameKey);
    ok += 1;
    rows.push({
      rowNumber,
      status: 'ok',
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
    });
  }

  return {
    success: true,
    data: {
      rows,
      summary: { ok, skipped, failed },
    },
  };
};
