import { generateTemporaryPassword } from '@/lib/temporary-password';
import { buildTemporaryPasswordWhatsAppHref } from '@/lib/temporary-password-share';
import { validateNewPassword } from '@/lib/password-change';

describe('temporary passwords (ZIG-I18-11)', () => {
  it('are two groups of four without look-alike characters, and not repeated', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(/^[abcdefghjkmnpqrstuvwxyz2-9]{4}-[abcdefghjkmnpqrstuvwxyz2-9]{4}$/);
      expect(password).not.toMatch(/[01oli]/);
      seen.add(password);
    }
    expect(seen.size).toBeGreaterThan(190);
  });

  it('share by WhatsApp with the name and the password', () => {
    const href = buildTemporaryPasswordWhatsAppHref('Carlos', 'kemo-7pdx');
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    const text = decodeURIComponent(href.split('text=')[1]);
    expect(text).toContain('Hola Carlos');
    expect(text).toContain('kemo-7pdx');
  });
});

describe('validateNewPassword', () => {
  it('asks for 8 characters and the same twice, in plain words', () => {
    expect(validateNewPassword('corta', 'corta')).toMatch(/al menos 8/);
    expect(validateNewPassword('mi-clave-2026', 'otra-clave-2026')).toMatch(/no son iguales/);
    expect(validateNewPassword('mi-clave-2026', 'mi-clave-2026')).toBeNull();
  });
});
