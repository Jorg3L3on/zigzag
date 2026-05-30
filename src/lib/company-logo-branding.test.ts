import {
  detectPdfImageFormat,
  getCompanyBrandInitials,
  getCompanyBrandFallbackHue,
} from '@/lib/company-logo-branding-shared';

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
});
