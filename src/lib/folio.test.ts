import { describe, expect, it } from '@jest/globals';
import {
  formatDisplayFolio,
  formatDocumentFolio,
  formatFolio,
  normalizeFolioPrefix,
  normalizeFolioSearch,
  parseFolioSearch,
  resolveFolioPrefix,
} from '@/lib/folio';

describe('folio helpers', () => {
  it('pads to four digits and grows past 9999', () => {
    expect(formatFolio('R', 7)).toBe('R-0007');
    expect(formatFolio('P', 12345)).toBe('P-12345');
  });

  it('normalizes prefixes to up to five uppercase letters or digits', () => {
    expect(normalizeFolioPrefix(' ab-c1 ')).toBe('ABC1');
    expect(normalizeFolioPrefix('abcdefg')).toBe('ABCDE');
    expect(normalizeFolioPrefix(null)).toBe('');
  });

  it('resolves the configured prefix per kind and falls back to P / R', () => {
    expect(resolveFolioPrefix('presupuesto', null)).toBe('P');
    expect(resolveFolioPrefix('ticket', {})).toBe('R');
    expect(
      resolveFolioPrefix('presupuesto', { folio_prefix_presupuesto: 'cot' }),
    ).toBe('COT');
    expect(resolveFolioPrefix('ticket', { folio_prefix_ticket: 'rec' })).toBe('REC');
  });

  it('shows the stored snapshot, not the current company setting', () => {
    expect(
      formatDocumentFolio({ folio_number: 3, folio_prefix: 'OLD', document_kind: 'ticket' }),
    ).toBe('OLD-0003');
  });

  it('falls back to #id when a row has no folio', () => {
    expect(formatDocumentFolio({ id: 9n, document_kind: 'ticket' })).toBe('#9');
  });

  it('shows the presupuesto folio on a converted recibo (ZIG-I17 Q1)', () => {
    expect(
      formatDisplayFolio({
        id: 50n,
        folio_number: 12,
        folio_prefix: 'R',
        document_kind: 'ticket',
        source_presupuesto_folio: { folio_number: 3, folio_prefix: 'P' },
      }),
    ).toBe('P-0003');
    expect(
      formatDisplayFolio({ id: 51n, folio_number: 13, folio_prefix: 'R', document_kind: 'ticket' }),
    ).toBe('R-0013');
  });

  it('strips LIKE wildcards from folio searches', () => {
    expect(normalizeFolioSearch(' r_% 00 ')).toBe('r 00');
  });
});

describe('parseFolioSearch', () => {
  it('reads R-0034, r34, 34 and 0034 as the same number', () => {
    expect(parseFolioSearch('R-0034')).toEqual({ prefix: 'R', number: 34 });
    expect(parseFolioSearch('r34')).toEqual({ prefix: 'R', number: 34 });
    expect(parseFolioSearch('34')).toEqual({ prefix: '', number: 34 });
    expect(parseFolioSearch(' 0034 ')).toEqual({ prefix: '', number: 34 });
  });

  it('ignores text that is not a folio', () => {
    expect(parseFolioSearch('Ana López')).toBeNull();
    expect(parseFolioSearch('')).toBeNull();
  });
});
