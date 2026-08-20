import { describe, expect, it } from '@jest/globals';
import {
  buildWhatsAppBalanceShare,
  buildWhatsAppDayVisitShare,
  buildWhatsAppHref,
  buildWhatsAppOfflineReceiptShare,
  buildWhatsAppQuoteShare,
  buildWhatsAppVisitShare,
  buildOfflineReceiptText,
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

  it('builds Spanish day-visit message for technician queue', () => {
    const result = buildWhatsAppDayVisitShare({
      phone: '5512345678',
      clientName: 'Luis',
      ticketId: 99,
      companyName: 'ZigZag Demo',
    });
    expect(result?.message).toContain('ZigZag Demo');
    expect(result?.message).toContain('ticket #99');
    expect(result?.message).toContain('en camino');
    expect(result?.href.startsWith('https://wa.me/5512345678?text=')).toBe(true);
  });

  it('builds Spanish presupuesto quote message', () => {
    const result = buildWhatsAppQuoteShare({
      phone: '5512345678',
      clientName: 'Ana',
      ticketId: 44,
      total: 2500,
      servicesSummary: 'Instalación, Revisión',
      companyName: 'Servicios Norte',
      validUntil: '2026-10-01T00:00:00.000Z',
    });
    expect(result?.message).toContain('Servicios Norte');
    expect(result?.message).toContain('presupuesto #44');
    expect(result?.message).toMatch(/\$2[,.]?500/);
    expect(result?.message).toContain('Instalación');
    expect(result?.message).toContain('¿Te confirmamos?');
  });

  it('builds offline receipt text with pending sync label', () => {
    const text = buildOfflineReceiptText({
      clientName: 'Hotel Sol',
      ticketId: null,
      localJobId: 'local-abc',
      workNotesSummary: 'Cambio de filtro',
      total: 800,
      paid: 300,
      balanceDue: 500,
      companyName: 'HVAC Demo',
    });
    expect(text).toContain('HVAC Demo — RECIBO SIMPLE');
    expect(text).toContain('pendiente de subir');
    expect(text).toContain('Cambio de filtro');
    expect(text).toContain('Sin internet');
  });

  it('builds WhatsApp offline receipt share', () => {
    const result = buildWhatsAppOfflineReceiptShare('5512345678', {
      clientName: 'Ana',
      ticketId: 12,
      total: 100,
      paid: 100,
      balanceDue: 0,
      companyName: 'Demo',
    });
    expect(result?.href.startsWith('https://wa.me/5512345678?text=')).toBe(true);
    expect(result?.message).toContain('RECIBO SIMPLE');
  });
});
