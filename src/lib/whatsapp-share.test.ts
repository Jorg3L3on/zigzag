import { describe, expect, it } from '@jest/globals';
import {
  buildWhatsAppBalanceShare,
  buildWhatsAppHref,
  buildWhatsAppVisitShare,
  normalizePhoneForWhatsApp,
} from '@/lib/whatsapp-share';

describe('whatsapp-share', () => {
  it('normalizes phones to digits for wa.me', () => {
    expect(normalizePhoneForWhatsApp('+52 55 1234 5678')).toBe('525512345678');
    expect(normalizePhoneForWhatsApp('')).toBeNull();
    expect(normalizePhoneForWhatsApp(null)).toBeNull();
  });

  it('builds encoded wa.me href', () => {
    const result = buildWhatsAppHref({
      phone: '5512345678',
      message: 'Hola saldo $100',
    });
    expect(result?.href).toBe(
      `https://wa.me/5512345678?text=${encodeURIComponent('Hola saldo $100')}`,
    );
  });

  it('returns null without usable phone', () => {
    expect(
      buildWhatsAppBalanceShare({
        phone: null,
        clientName: 'Ana',
        ticketId: 12,
        balanceDue: 150,
      }),
    ).toBeNull();
  });

  it('builds Spanish balance reminder message', () => {
    const result = buildWhatsAppBalanceShare({
      phone: '5512345678',
      clientName: 'Ana',
      ticketId: 12,
      balanceDue: 150,
      companyName: 'Fumigaciones Norte',
    });
    expect(result?.message).toContain('Fumigaciones Norte');
    expect(result?.message).toContain('ticket #12');
    expect(result?.message).toContain('Ana');
    expect(result?.message).toMatch(/\$150/);
    expect(result?.href.startsWith('https://wa.me/5512345678?text=')).toBe(true);
  });

  it('builds Spanish visit reminder message', () => {
    const result = buildWhatsAppVisitShare({
      phone: '5512345678',
      clientName: 'Ana',
      serviceName: 'Fumigación',
      nextDueAt: '2026-09-01T12:00:00.000Z',
      companyName: 'Fumigaciones Norte',
    });
    expect(result?.message).toContain('Fumigación');
    expect(result?.message).toContain('Ana');
    expect(result?.href.startsWith('https://wa.me/5512345678?text=')).toBe(true);
  });
});
