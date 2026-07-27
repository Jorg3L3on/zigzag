import { toCsv } from '@/lib/csv';

/** Canonical Spanish headers for Service export / plantilla. */
export const SERVICE_CSV_HEADERS = [
  'nombre',
  'descripción',
  'precio',
] as const;

export type ServiceCsvHeader = (typeof SERVICE_CSV_HEADERS)[number];

export const SERVICE_CSV_MAX_ROWS = 500;

/** Normalized internal field keys after alias resolution. */
export type ServiceCsvNormalized = {
  name: string;
  description: string;
  price: string;
};

const NAME_ALIASES = new Set(['nombre', 'name']);
const DESCRIPTION_ALIASES = new Set([
  'descripción',
  'descripcion',
  'description',
]);
const PRICE_ALIASES = new Set(['precio', 'price']);

const normalizeHeaderKey = (raw: string): string =>
  raw.replace(/^\ufeff/, '').trim().toLowerCase();

/**
 * Map a CSV record (any accepted header language) onto normalized
 * name/description/price fields. Returns null if a required column is missing.
 */
export const normalizeServiceCsvRecord = (
  record: Record<string, string>,
): ServiceCsvNormalized | null => {
  let name: string | undefined;
  let description: string | undefined;
  let price: string | undefined;

  for (const [rawKey, value] of Object.entries(record)) {
    const key = normalizeHeaderKey(rawKey);
    if (NAME_ALIASES.has(key) && name === undefined) {
      name = value;
    } else if (DESCRIPTION_ALIASES.has(key) && description === undefined) {
      description = value;
    } else if (PRICE_ALIASES.has(key) && price === undefined) {
      price = value;
    }
  }

  if (name === undefined || description === undefined || price === undefined) {
    return null;
  }

  return { name, description, price };
};

export const assertServiceCsvRowCount = (
  rowCount: number,
): { ok: true } | { ok: false; error: string } => {
  if (rowCount <= 0) {
    return { ok: false, error: 'El archivo no contiene filas de datos' };
  }
  if (rowCount > SERVICE_CSV_MAX_ROWS) {
    return {
      ok: false,
      error: `Máximo ${SERVICE_CSV_MAX_ROWS} filas por archivo`,
    };
  }
  return { ok: true };
};

const PLANTILLA_EXAMPLE_ROWS: Array<Record<ServiceCsvHeader, string>> = [
  {
    nombre: 'Lavado express',
    descripción: 'Lavado exterior rápido de ejemplo',
    precio: '150.00',
  },
  {
    nombre: 'Detallado premium',
    descripción: 'Limpieza interior y exterior de ejemplo',
    precio: '899.50',
  },
];

/** CSV plantilla text (UTF-8, caller may prepend BOM). */
export const buildServiceCsvPlantilla = (): string =>
  toCsv([...SERVICE_CSV_HEADERS], PLANTILLA_EXAMPLE_ROWS);
