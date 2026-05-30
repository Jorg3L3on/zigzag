import {
  COMPANY_LOGO_MAX_BYTES,
  isTrustedCompanyLogoUrl,
  resolveCompanyLogoUrl,
  validateCompanyLogoUpload,
} from '@/lib/company-logo-storage';

describe('company logo storage', () => {
  it('accepts valid png uploads within limits', () => {
    expect(
      validateCompanyLogoUpload({
        contentType: 'image/png',
        size: 120_000,
        width: 256,
        height: 128,
      }).ok,
    ).toBe(true);
  });

  it('rejects unsupported mime types and oversized files', () => {
    expect(
      validateCompanyLogoUpload({
        contentType: 'image/gif',
        size: 1000,
        width: 200,
        height: 200,
      }).ok,
    ).toBe(false);

    expect(
      validateCompanyLogoUpload({
        contentType: 'image/png',
        size: COMPANY_LOGO_MAX_BYTES + 1,
        width: 200,
        height: 200,
      }).ok,
    ).toBe(false);
  });

  it('trusts vercel blob hosts and legacy icon paths only', () => {
    expect(
      isTrustedCompanyLogoUrl(
        'https://abc.public.blob.vercel-storage.com/company-logos/1/logo-abc.png',
      ),
    ).toBe(true);
    expect(isTrustedCompanyLogoUrl('/icons/icon-192.png')).toBe(true);
    expect(isTrustedCompanyLogoUrl('https://evil.example/logo.png')).toBe(false);
    expect(resolveCompanyLogoUrl('https://evil.example/logo.png')).toBeNull();
  });
});
