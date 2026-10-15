/**
 * Text the receipt PDF can draw (ZIG-I12 Q3). The embedded IBM Plex fonts are
 * subset to Latin and common signs (ZIG-I20-4), not Cyrillic, emoji, CJK,
 * Arabic or Devanagari; jsPDF drops those glyphs silently and leaves stray
 * marks. The PDF strips them cleanly instead, and the composer warns before
 * saving.
 *
 * Client-safe (no font data): the ranges are the code points present in all
 * five embedded fonts, checked against the font modules in
 * pdf-text-support.test.ts.
 */
import PDF_SUPPORTED_RANGES_JSON from './pdf-supported-ranges.json';

/**
 * Inclusive code point ranges the embedded fonts carry (ZIG-I20-4): Basic
 * Latin, Latin-1, Latin Extended-A and the punctuation, currency, arrow and
 * check signs the documents use. `scripts/generate-pdf-fonts.mjs` subsets the
 * IBM Plex TTFs to exactly this list, so the two never drift.
 */
export const PDF_SUPPORTED_RANGES: ReadonlyArray<readonly [number, number]> =
  (PDF_SUPPORTED_RANGES_JSON as Array<[string, string]>).map(
    ([start, end]) => [Number(start), Number(end)] as const,
  );

/** Zero-width marks and variation selectors: invisible, so never worth a warning. */
const INVISIBLE = /[​-‏⁠︀-️]/gu;
const WHITESPACE_EXCEPT_NEWLINE = /[^\S\n]+/gu;

const supported = (codePoint: number): boolean => {
  let low = 0;
  let high = PDF_SUPPORTED_RANGES.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const [start, end] = PDF_SUPPORTED_RANGES[mid];
    if (codePoint < start) high = mid - 1;
    else if (codePoint > end) low = mid + 1;
    else return true;
  }
  return false;
};

export const isPdfSupportedCodePoint = (codePoint: number): boolean => supported(codePoint);

/** Characters of the text the PDF cannot draw, each once, in order of appearance. */
export const findUnsupportedPdfChars = (value: string | null | undefined): string[] => {
  if (!value) return [];
  const found = new Set<string>();
  for (const char of value.normalize('NFC').replace(INVISIBLE, '')) {
    if (/\s/u.test(char)) continue;
    if (!supported(char.codePointAt(0) as number)) found.add(char);
  }
  return [...found];
};

/**
 * The text the PDF will draw: NFC, unsupported characters removed, runs of
 * spaces collapsed (line breaks kept) and the ends trimmed.
 */
export const sanitizePdfText = (value: string | null | undefined): string => {
  if (!value) return '';
  let out = '';
  for (const char of value.normalize('NFC').replace(INVISIBLE, '')) {
    if (char === '\n') out += '\n';
    else if (char === '\r') continue;
    else if (/\s/u.test(char)) out += ' ';
    else if (supported(char.codePointAt(0) as number)) out += char;
  }
  return out
    .replace(WHITESPACE_EXCEPT_NEWLINE, ' ')
    .replace(/ ?\n ?/gu, '\n')
    .trim();
};
