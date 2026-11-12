/**
 * @jest-environment jsdom
 */
import {
  DOCUMENT_LINES_DENSITY_KEY,
  readDocumentLinesDensity,
  writeDocumentLinesDensity,
} from '@/lib/document-lines-density';

describe('document lines density (ZIG-I28-1)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to Compacto and keeps Detallado across a fresh read', () => {
    expect(readDocumentLinesDensity()).toBe('compact');
    expect(window.localStorage.getItem(DOCUMENT_LINES_DENSITY_KEY)).toBeNull();

    writeDocumentLinesDensity('detailed');
    expect(window.localStorage.getItem(DOCUMENT_LINES_DENSITY_KEY)).toBe('detailed');
    expect(readDocumentLinesDensity()).toBe('detailed');

    writeDocumentLinesDensity('compact');
    expect(window.localStorage.getItem(DOCUMENT_LINES_DENSITY_KEY)).toBeNull();
    expect(readDocumentLinesDensity()).toBe('compact');
  });

  it('reads the old stored Compacto value as Compacto', () => {
    window.localStorage.setItem(DOCUMENT_LINES_DENSITY_KEY, 'compact');
    expect(readDocumentLinesDensity()).toBe('compact');
  });
});
