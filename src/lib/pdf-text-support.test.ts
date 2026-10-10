import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  findUnsupportedPdfChars,
  PDF_SUPPORTED_RANGES,
  sanitizePdfText,
} from '@/lib/pdf-text-support';
import { ttfCodePoints } from '@/test/ttf-cmap';

const FONT_DIR = join(process.cwd(), 'assets/fonts/ibm-plex');

describe('PDF_SUPPORTED_RANGES', () => {
  it('is sorted and non-overlapping (binary search relies on it)', () => {
    PDF_SUPPORTED_RANGES.forEach(([start, end], index) => {
      expect(start).toBeLessThanOrEqual(end);
      if (index > 0) expect(start).toBeGreaterThan(PDF_SUPPORTED_RANGES[index - 1][1]);
    });
  });

  it('only allows code points that every embedded font draws', () => {
    const fonts = readdirSync(FONT_DIR)
      .filter((file) => file.endsWith('.ttf'))
      .map((file) => ({ file, codePoints: ttfCodePoints(join(FONT_DIR, file)) }));
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

describe('sanitizePdfText', () => {
  it('keeps Latin, accents, Cyrillic and common symbols', () => {
    expect(sanitizePdfText('Instalación niño ¿qué? №5 русский — 12 € ✓')).toBe(
      'Instalación niño ¿qué? №5 русский — 12 € ✓',
    );
  });

  it('strips emoji, CJK, Arabic and Devanagari without leaving stray marks', () => {
    expect(sanitizePdfText('🔥 Urgente 维修 صيانة हिन्दी')).toBe('Urgente');
    expect(sanitizePdfText('Multilenguaje: 😀, 日本語, русский')).toBe('Multilenguaje: , , русский');
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
