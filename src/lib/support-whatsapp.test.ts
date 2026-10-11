import { buildSupportWhatsAppHref } from '@/lib/support-whatsapp';

describe('buildSupportWhatsAppHref (ZIG-I18-11)', () => {
  it('is hidden when the number is not configured or unusable', () => {
    expect(buildSupportWhatsAppHref(undefined)).toBeNull();
    expect(buildSupportWhatsAppHref('')).toBeNull();
    expect(buildSupportWhatsAppHref('abc')).toBeNull();
    expect(buildSupportWhatsAppHref('12345')).toBeNull();
  });

  it('builds a wa.me link with the message prefilled', () => {
    const href = buildSupportWhatsAppHref('+52 998 345 7712', 'ana@demo.mx');
    expect(href).toMatch(/^https:\/\/wa\.me\/529983457712\?text=/);
    expect(decodeURIComponent(href!.split('text=')[1])).toContain('olvidé mi contraseña');
    expect(decodeURIComponent(href!.split('text=')[1])).toContain('ana@demo.mx');
  });

  it('reads a bare ten-digit number as Mexico', () => {
    expect(buildSupportWhatsAppHref('9983457712')).toMatch(/^https:\/\/wa\.me\/529983457712\?/);
  });
});
