import {
  detectPdfImageFormat,
  getCompanyBrandInitials,
  getCompanyBrandFallbackHue,
} from '@/lib/company-logo-branding-shared';
import { prepareCompanyLogoForPdf } from '@/lib/company-logo-branding-server';
import sharp from 'sharp';

describe('company logo branding', () => {
  it('derives stable initials and hue from company name', () => {
    expect(getCompanyBrandInitials('Soluciones Chano')).toBe('SC');
    expect(getCompanyBrandInitials('zigzag')).toBe('Z');
    expect(getCompanyBrandFallbackHue('zigzag')).toBe(
      getCompanyBrandFallbackHue('zigzag'),
    );
  });

  it('detects pdf image formats from data urls', () => {
    expect(detectPdfImageFormat('data:image/png;base64,abc')).toBe('PNG');
    expect(detectPdfImageFormat('data:image/jpeg;base64,abc')).toBe('JPEG');
    expect(detectPdfImageFormat('data:text/plain,abc')).toBeNull();
  });

  it('trims padded whitespace and returns a circular png data url for pdf branding', async () => {
    const padded = await sharp({
      create: {
        width: 240,
        height: 240,
        channels: 3,
        background: '#ffffff',
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 80,
              height: 80,
              channels: 3,
              background: '#1d4ed8',
            },
          })
            .png()
            .toBuffer(),
          left: 80,
          top: 80,
        },
      ])
      .png()
      .toBuffer();

    const dataUrl = await prepareCompanyLogoForPdf(padded);
    expect(dataUrl?.startsWith('data:image/png;base64,')).toBe(true);

    const prepared = Buffer.from(dataUrl!.split(',')[1]!, 'base64');
    const meta = await sharp(prepared).metadata();
    expect(meta.width).toBe(320);
    expect(meta.height).toBe(320);
    expect(meta.channels).toBe(4);
    expect(meta.hasAlpha).toBe(true);

    // Corner pixels should be transparent after the circular mask.
    const { data } = await sharp(prepared)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
  });
});
