/**
 * Company folio series (ZIG-I17-4..6): P-0001 for presupuestos, R-0001 for
 * tickets/recibos. Numbers are per company and per document kind, assigned when
 * the document is created and never reused or restarted.
 */

import { normalizeTicketDocumentKind } from '@/lib/ticket-document-kind';
import type { TicketDocumentKind } from '@/lib/ticket-document-kind';

export const FOLIO_PREFIX_MAX_LENGTH = 5;

export const DEFAULT_FOLIO_PREFIX: Record<TicketDocumentKind, string> = {
  presupuesto: 'P',
  ticket: 'R',
};

/** Digits are padded to four (`0007`); a series past 9999 simply grows. */
export const FOLIO_MIN_DIGITS = 4;

export type FolioParts = {
  folio_number?: number | null;
  folio_prefix?: string | null;
};

/** Uppercase letters and digits only, up to five. Anything else is dropped. */
export const normalizeFolioPrefix = (value: string | null | undefined): string =>
  (value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, FOLIO_PREFIX_MAX_LENGTH);

/** What the company configured for a kind, or the default (P / R). */
export const resolveFolioPrefix = (
  kind: string | null | undefined,
  settings:
    | {
        folio_prefix_presupuesto?: string | null;
        folio_prefix_ticket?: string | null;
      }
    | null
    | undefined,
): string => {
  const normalizedKind = normalizeTicketDocumentKind(kind);
  const configured = normalizeFolioPrefix(
    normalizedKind === 'presupuesto'
      ? settings?.folio_prefix_presupuesto
      : settings?.folio_prefix_ticket,
  );
  return configured || DEFAULT_FOLIO_PREFIX[normalizedKind];
};

export const formatFolio = (prefix: string, number: number): string =>
  `${prefix}-${String(number).padStart(FOLIO_MIN_DIGITS, '0')}`;

/**
 * The folio of a document as people read it: `R-0012`. A row without a folio
 * (it should not exist after migration 0032) falls back to `#id`.
 */
export const formatDocumentFolio = (
  row: FolioParts & { id?: bigint | number | string; document_kind?: string | null },
): string => {
  if (row.folio_number != null) {
    return formatFolio(
      row.folio_prefix || DEFAULT_FOLIO_PREFIX[normalizeTicketDocumentKind(row.document_kind)],
      row.folio_number,
    );
  }
  return row.id != null ? `#${String(row.id)}` : '';
};

/**
 * Reads what someone types to find a folio: `R-0034`, `r34`, `34` or `0034`.
 * Letters (if any) are the prefix, digits are the number. Null when the text
 * is not shaped like a folio, so it falls back to the plain text search.
 */
export const parseFolioSearch = (
  value: string,
): { prefix: string; number: number } | null => {
  const match = /^\s*([a-z0-9]{0,5}?)\s*-?\s*(\d{1,9})\s*$/i.exec(value);
  if (!match) return null;
  const number = Number.parseInt(match[2], 10);
  if (!Number.isSafeInteger(number)) return null;
  return { prefix: match[1].toUpperCase(), number };
};

/** SQL ILIKE pattern text for the stored folio, e.g. searching `r-00` or `0012`. */
export const normalizeFolioSearch = (value: string): string =>
  value.trim().replace(/[%_\\]/g, '');

/**
 * The folio printed on a recibo. A work ticket converted from a presupuesto keeps
 * showing the presupuesto's P folio (ZIG-I17-5); otherwise it shows its own.
 */
export const formatDisplayFolio = (
  row: FolioParts & {
    id?: bigint | number | string;
    document_kind?: string | null;
    source_presupuesto_folio?: FolioParts | null;
  },
): string =>
  row.source_presupuesto_folio?.folio_number != null
    ? formatDocumentFolio({ ...row.source_presupuesto_folio, document_kind: 'presupuesto' })
    : formatDocumentFolio(row);
