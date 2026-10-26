import {
  describePresupuestoVigencia,
  describePresupuestoVigenciaCard,
  describePresupuestoVigenciaChip,
  describePresupuestoVenceCell,
} from '@/lib/presupuesto-vigencia';

const now = new Date('2026-10-10T15:00:00');

describe('describePresupuestoVigencia (ZIG-I13-5)', () => {
  it('shows the date and the days left', () => {
    expect(
      describePresupuestoVigencia({ expiresAt: '2026-11-09T12:00:00', status: 'abierto', now }),
    ).toEqual({ text: 'Vence el 9 nov · quedan 30 días', tone: 'ok' });
  });

  it('singular and soon', () => {
    expect(
      describePresupuestoVigencia({ expiresAt: '2026-10-11T12:00:00', status: 'abierto', now }),
    ).toEqual({ text: 'Vence el 11 oct · queda 1 día', tone: 'soon' });
  });

  it('a quote that expires today still has today', () => {
    expect(
      describePresupuestoVigencia({ expiresAt: '2026-10-10T08:00:00', status: 'abierto', now }),
    ).toEqual({ text: 'Vence hoy · 10 oct', tone: 'soon' });
  });

  it('Vencido once past, whether the status says so or not', () => {
    expect(
      describePresupuestoVigencia({ expiresAt: '2026-10-01T12:00:00', status: 'vencido', now }).text,
    ).toBe('Venció el 1 oct');
    expect(
      describePresupuestoVigencia({ expiresAt: '2026-10-01T12:00:00', status: 'abierto', now }).tone,
    ).toBe('expired');
  });

  it('Sin vencimiento without a date', () => {
    expect(describePresupuestoVigencia({ expiresAt: null, status: 'abierto', now })).toEqual({
      text: 'Sin vencimiento',
      tone: 'none',
    });
  });

  it('adds the year when it is not this one; converted/cancelled show no countdown', () => {
    expect(
      describePresupuestoVigencia({ expiresAt: '2027-01-15T12:00:00', status: 'abierto', now }).text,
    ).toMatch(/^Vence el 15 ene 2027 · quedan \d+ días$/);
    expect(
      describePresupuestoVigencia({ expiresAt: '2026-11-09T12:00:00', status: 'cancelado', now }),
    ).toEqual({ text: 'Vencía el 9 nov', tone: 'none' });
  });
});

describe('describePresupuestoVigenciaChip (ZIG-I29-1)', () => {
  const chip = (expiresAt: string | null, status: 'abierto' | 'vencido' | 'convertido' | 'cancelado' = 'abierto') =>
    describePresupuestoVigenciaChip({ expiresAt, status, now });

  it('counts the days left, today and tomorrow', () => {
    expect(chip('2026-10-17T12:00:00')).toEqual({ text: 'Vence en 7 días', tone: 'ok' });
    expect(chip('2026-10-13T12:00:00')).toEqual({ text: 'Vence en 3 días', tone: 'soon' });
    expect(chip('2026-10-11T12:00:00')).toEqual({ text: 'Vence mañana', tone: 'soon' });
    expect(chip('2026-10-10T08:00:00')).toEqual({ text: 'Vence hoy', tone: 'soon' });
  });

  it('says how long ago it expired', () => {
    expect(chip('2026-10-09T12:00:00', 'vencido')).toEqual({ text: 'Venció ayer', tone: 'expired' });
    expect(chip('2026-10-01T12:00:00', 'vencido')).toEqual({ text: 'Venció hace 9 días', tone: 'expired' });
  });

  it('has no chip once accepted or canceled, and a neutral one without a date', () => {
    expect(chip('2026-10-17T12:00:00', 'convertido')).toBeNull();
    expect(chip('2026-10-17T12:00:00', 'cancelado')).toBeNull();
    expect(chip(null)).toEqual({ text: 'Sin vencimiento', tone: 'none' });
  });
});

describe('describePresupuestoVigenciaCard (ZIG-I29-1)', () => {
  const card = (
    ticketDate: string | null,
    expiresAt: string | null,
    status: 'abierto' | 'vencido' | 'convertido' | 'cancelado' = 'abierto',
  ) => describePresupuestoVigenciaCard({ ticketDate, expiresAt, status, now });

  it('shows the long date, the days left and the elapsed share of the validity', () => {
    expect(card('2026-10-01T12:00:00', '2026-10-31T12:00:00')).toEqual({
      text: 'Vence el 31 de octubre · quedan 21 días',
      tone: 'ok',
      progress: 0.3,
      issuedText: 'Emitido el 1 oct',
      lengthText: 'Vigencia de 30 días',
    });
  });

  it('fills the bar on the last day and once expired', () => {
    expect(card('2026-09-25T12:00:00', '2026-10-10T12:00:00')).toMatchObject({
      text: 'Vence hoy · 10 de octubre',
      tone: 'soon',
      progress: 1,
    });
    expect(card('2026-09-20T12:00:00', '2026-10-07T12:00:00', 'vencido')).toMatchObject({
      text: 'Venció el 7 de octubre · hace 3 días',
      tone: 'expired',
      progress: 1,
      lengthText: 'Vigencia de 17 días',
    });
  });

  it('has no bar without an expiry date', () => {
    expect(card('2026-10-01T12:00:00', null)).toEqual({
      text: 'Sin vencimiento',
      tone: 'none',
      progress: null,
      issuedText: 'Emitido el 1 oct',
      lengthText: null,
    });
  });
});

describe('describePresupuestoVenceCell (canvas ListaPresuA)', () => {
  it('puts how far on top and the date with the validity length under it', () => {
    expect(
      describePresupuestoVenceCell({
        expiresAt: '2026-10-10T08:00:00',
        ticketDate: '2026-09-25T12:00:00',
        status: 'abierto',
        now,
      }),
    ).toEqual({ text: 'Vence hoy', sub: '10 oct · vigencia de 15 días', tone: 'soon' });
    expect(
      describePresupuestoVenceCell({ expiresAt: '2026-10-07T12:00:00', status: 'vencido', now }),
    ).toEqual({ text: 'Venció hace 3 días', sub: '7 oct', tone: 'expired' });
  });

  it('is grey once closed or without a date', () => {
    expect(describePresupuestoVenceCell({ expiresAt: '2026-11-09T12:00:00', status: 'convertido', now })).toEqual({
      text: 'Vencía 9 nov',
      sub: null,
      tone: 'none',
    });
    expect(describePresupuestoVenceCell({ expiresAt: null, status: 'abierto', now })).toEqual({
      text: 'Sin vencimiento',
      sub: null,
      tone: 'none',
    });
  });
});
