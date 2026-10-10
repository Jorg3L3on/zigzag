/**
 * Text the receipt PDF can draw (ZIG-I12 Q3). The embedded IBM Plex fonts cover
 * Latin, part of Cyrillic and common punctuation, not emoji, CJK, Arabic or
 * Devanagari; jsPDF drops those glyphs silently and leaves stray marks. The
 * PDF strips them cleanly instead, and the composer warns before saving.
 *
 * Client-safe (no font data): the ranges are the code points present in all
 * five embedded fonts, checked against the font files in pdf-text.test.ts.
 */

/** Inclusive code point ranges present in every embedded font. */
export const PDF_SUPPORTED_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0020, 0x007E],
  [0x00A0, 0x017F],
  [0x018F, 0x018F],
  [0x0192, 0x0192],
  [0x01A0, 0x01A1],
  [0x01AF, 0x01B0],
  [0x01CD, 0x01DC],
  [0x01FA, 0x01FF],
  [0x0218, 0x021B],
  [0x0237, 0x0237],
  [0x0259, 0x0259],
  [0x02BB, 0x02BC],
  [0x02C6, 0x02C7],
  [0x02D8, 0x02DD],
  [0x0300, 0x0304],
  [0x0306, 0x030C],
  [0x0312, 0x0312],
  [0x0315, 0x0315],
  [0x031B, 0x031B],
  [0x0323, 0x0323],
  [0x0326, 0x0328],
  [0x03C0, 0x03C0],
  [0x0400, 0x045F],
  [0x0462, 0x0463],
  [0x046A, 0x046B],
  [0x0472, 0x0475],
  [0x0490, 0x04C2],
  [0x04CF, 0x04D9],
  [0x04DC, 0x04E9],
  [0x04EE, 0x04F9],
  [0x0524, 0x0525],
  [0x0E3F, 0x0E3F],
  [0x1E80, 0x1E85],
  [0x1E9E, 0x1E9E],
  [0x1EA0, 0x1EF9],
  [0x2000, 0x200A],
  [0x2010, 0x2015],
  [0x2018, 0x201A],
  [0x201C, 0x201E],
  [0x2020, 0x2022],
  [0x2026, 0x2026],
  [0x2028, 0x2029],
  [0x202F, 0x2030],
  [0x2032, 0x2033],
  [0x2039, 0x203A],
  [0x2044, 0x2044],
  [0x2070, 0x2070],
  [0x2074, 0x2079],
  [0x2080, 0x2089],
  [0x20A1, 0x20A1],
  [0x20A4, 0x20A4],
  [0x20A6, 0x20A6],
  [0x20A8, 0x20AE],
  [0x20B1, 0x20B2],
  [0x20B4, 0x20B5],
  [0x20B8, 0x20BA],
  [0x20BD, 0x20BD],
  [0x20BF, 0x20BF],
  [0x2113, 0x2113],
  [0x2116, 0x2116],
  [0x2122, 0x2122],
  [0x2126, 0x2126],
  [0x212E, 0x212E],
  [0x2150, 0x2151],
  [0x2153, 0x215E],
  [0x2190, 0x2199],
  [0x21A9, 0x21AA],
  [0x21B0, 0x21B3],
  [0x21B6, 0x21B7],
  [0x21BA, 0x21BB],
  [0x21C4, 0x21C4],
  [0x21C6, 0x21C6],
  [0x2202, 0x2202],
  [0x2206, 0x2206],
  [0x220F, 0x220F],
  [0x2211, 0x2212],
  [0x2215, 0x2215],
  [0x2219, 0x221A],
  [0x221E, 0x221E],
  [0x222B, 0x222B],
  [0x2236, 0x2236],
  [0x2248, 0x2248],
  [0x2260, 0x2260],
  [0x2264, 0x2265],
  [0x25CA, 0x25CA],
  [0x2713, 0x2713],
  [0x274C, 0x274C],
  [0x2B0E, 0x2B11],
  [0xFB01, 0xFB02],
];

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
