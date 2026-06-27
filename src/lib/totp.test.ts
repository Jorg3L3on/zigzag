import {
  buildOtpAuthUri,
  generateTotp,
  generateTotpSecret,
  verifyTotp,
} from '@/lib/totp';

describe('totp', () => {
  it('verifies a freshly generated token', () => {
    const secret = generateTotpSecret();
    const token = generateTotp(secret);
    expect(verifyTotp(token, secret)).toBe(true);
  });

  it('rejects an incorrect token', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp('000000', secret)).toBe(false);
  });

  it('rejects empty inputs', () => {
    expect(verifyTotp('', 'SECRET')).toBe(false);
    expect(verifyTotp('123456', '')).toBe(false);
  });

  it('builds an otpauth provisioning uri with the issuer', () => {
    const uri = buildOtpAuthUri('JBSWY3DPEHPK3PXP', 'user@example.com');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('ZigZag');
  });
});
