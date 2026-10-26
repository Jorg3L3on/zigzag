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

  it('defaults to Detallado and keeps Compacto across a fresh read', () => {
    expect(readDocumentLinesDensity()).toBe('detailed');
    expect(window.localStorage.getItem(DOCUMENT_LINES_DENSITY_KEY)).toBeNull();

    writeDocumentLinesDensity('compact');
    expect(window.localStorage.getItem(DOCUMENT_LINES_DENSITY_KEY)).toBe('compact');
    expect(readDocumentLinesDensity()).toBe('compact');

    writeDocumentLinesDensity('detailed');
    expect(window.localStorage.getItem(DOCUMENT_LINES_DENSITY_KEY)).toBeNull();
    expect(readDocumentLinesDensity()).toBe('detailed');
  });
});
