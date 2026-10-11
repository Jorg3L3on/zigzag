import { describePresupuestoVigencia } from '@/lib/presupuesto-vigencia';

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
