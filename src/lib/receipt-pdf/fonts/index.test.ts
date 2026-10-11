/**
 * @jest-environment node
 */
import { jsPDF } from 'jspdf';
import { RECEIPT_FONTS, registerReceiptFonts } from '@/lib/receipt-pdf/fonts';

type TtfMetadata = { characterToGlyph: (code: number) => number };

describe('registerReceiptFonts', () => {
  it('registers Plex Sans 400/500/600 and Plex Mono 400/500', () => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    registerReceiptFonts(doc);
    const fonts = doc.getFontList();

    for (const family of Object.values(RECEIPT_FONTS)) {
      expect(fonts[family]).toEqual(['normal']);
    }
  });

  it('draws Spanish accents and $ with the embedded fonts, not a fallback', () => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    registerReceiptFonts(doc);
    const sample = 'áéíóúñÑ·$';

    for (const family of Object.values(RECEIPT_FONTS)) {
      doc.setFont(family, 'normal');
      expect(doc.getFont().fontName).toBe(family);
      const metadata = doc.getFont().metadata as TtfMetadata;
      for (const char of sample) {
        expect(metadata.characterToGlyph(char.charCodeAt(0))).toBeGreaterThan(0);
      }
      doc.text(`${sample} $1,234.00 MXN`, 40, 40);
    }

    const pdf = doc.output();
    for (const family of Object.values(RECEIPT_FONTS)) {
      expect(pdf).toContain(`/BaseFont /${family}`);
    }
    expect(pdf).toContain('/Subtype /CIDFontType2');
  });
});
