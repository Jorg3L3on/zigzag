import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  findUnsupportedPdfChars,
  PDF_SUPPORTED_RANGES,
  sanitizePdfText,
} from '@/lib/pdf-text-support';
import { ttfCodePoints } from '@/test/ttf-cmap';

const FONT_MODULE_DIR = join(process.cwd(), 'src/lib/receipt-pdf/fonts');
const FULL_FONT_DIR = join(process.cwd(), 'assets/fonts/ibm-plex');

/** The TTF a generated base64 module embeds. */
const embeddedFont = (file: string): Buffer => {
  const source = readFileSync(join(FONT_MODULE_DIR, file), 'utf8');
  const base64 = source.match(/'([A-Za-z0-9+/=]+)';/)?.[1] ?? '';
  return Buffer.from(base64, 'base64');
};

describe('PDF_SUPPORTED_RANGES', () => {
  it('is sorted and non-overlapping (binary search relies on it)', () => {
    PDF_SUPPORTED_RANGES.forEach(([start, end], index) => {
      expect(start).toBeLessThanOrEqual(end);
      if (index > 0) expect(start).toBeGreaterThan(PDF_SUPPORTED_RANGES[index - 1][1]);
    });
  });

  it('only allows code points that every embedded (subset) font draws', () => {
    const fonts = readdirSync(FONT_MODULE_DIR)
      .filter((file) => /^plex-.*\.ts$/.test(file))
      .map((file) => ({ file, codePoints: ttfCodePoints(embeddedFont(file)) }));
    expect(fonts.length).toBe(5);

    for (const [start, end] of PDF_SUPPORTED_RANGES) {
      for (let code = start; code <= end; code += 1) {
        for (const font of fonts) {
          if (!font.codePoints.has(code)) {
            throw new Error(`U+${code.toString(16)} is allowed but ${font.file} has no glyph`);
          }
        }
      }
    }
  });
});

describe('PDF font subset (ZIG-I20-4)', () => {
  it('embeds fonts well under half the size of the full IBM Plex files', () => {
    const full = readdirSync(FULL_FONT_DIR)
      .filter((file) => file.endsWith('.ttf'))
      .reduce((sum, file) => sum + readFileSync(join(FULL_FONT_DIR, file)).length, 0);
    const embedded = readdirSync(FONT_MODULE_DIR)
      .filter((file) => /^plex-.*\.ts$/.test(file))
      .reduce((sum, file) => sum + embeddedFont(file).length, 0);
    expect(embedded).toBeLessThan(full * 0.5);
  });

  it('keeps every glyph the documents print: accents, ñ, ¿¡, $, €, · • … – — ✓', () => {
    const sample = 'áéíóúüñÑÁÉÍÓÚÜ ¿¡ $ € · • … – — ✓ № ™ ½ ²';
    expect(findUnsupportedPdfChars(sample)).toEqual([]);
  });
});

describe('sanitizePdfText', () => {
  it('keeps Latin, accents and common symbols; Cyrillic left with the subset (ZIG-I20-4)', () => {
    expect(sanitizePdfText('Instalación niño ¿qué? №5 — 12 € ✓')).toBe(
      'Instalación niño ¿qué? №5 — 12 € ✓',
    );
    expect(sanitizePdfText('Instalación русский — ok')).toBe('Instalación — ok');
  });

  it('strips emoji, CJK, Arabic and Devanagari without leaving stray marks', () => {
    expect(sanitizePdfText('🔥 Urgente 维修 صيانة हिन्दी')).toBe('Urgente');
    expect(sanitizePdfText('Multilenguaje: 😀, 日本語, русский')).toBe('Multilenguaje: , ,');
  });

  it('removes emoji sequences with joiners and variation selectors', () => {
    expect(sanitizePdfText('Equipo 👨‍👩‍👧 ✔️ listo')).toBe('Equipo listo');
  });

  it('collapses the spaces a removed character leaves, keeping line breaks', () => {
    expect(sanitizePdfText('a 🔥  🔥 b\n\n🔥\nc')).toBe('a b\n\n\nc');
  });

  it('normalizes decomposed accents to NFC', () => {
    expect(sanitizePdfText('Café')).toBe('Café');
  });

  it('returns an empty string for nothing', () => {
    expect(sanitizePdfText(null)).toBe('');
    expect(sanitizePdfText('🔥')).toBe('');
  });
});

describe('findUnsupportedPdfChars', () => {
  it('lists each unsupported character once, in order', () => {
    expect(findUnsupportedPdfChars('🔥 Urgente 维修 🔥 صيانة')).toEqual(['🔥', '维', '修', 'ص', 'ي', 'ا', 'ن', 'ة']);
  });

  it('ignores invisible marks and ordinary text', () => {
    expect(findUnsupportedPdfChars('Hola​ mundo ñ')).toEqual([]);
    expect(findUnsupportedPdfChars('')).toEqual([]);
    expect(findUnsupportedPdfChars(undefined)).toEqual([]);
  });
});
