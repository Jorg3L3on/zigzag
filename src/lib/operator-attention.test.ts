import { buildOperatorAttentionSignals } from '@/lib/operator-attention';

describe('buildOperatorAttentionSignals', () => {
  const now = new Date('2026-08-13T12:00:00.000Z');

  it('returns empty when the tenant is healthy', () => {
    expect(
      buildOperatorAttentionSignals({
        productionReady: true,
        missingCount: 0,
        missingLabels: [],
        allowsAuthentication: true,
        lastIncidentAt: null,
        lastIncidentLabel: null,
        now,
      }),
    ).toEqual([]);
  });

  it('surfaces readiness, recent incidents, and auth blocks', () => {
    const signals = buildOperatorAttentionSignals({
      productionReady: false,
      missingCount: 2,
      missingLabels: ['RFC en configuración', 'Moneda por defecto'],
      allowsAuthentication: false,
      lastIncidentAt: '2026-08-12T12:00:00.000Z',
      lastIncidentLabel: 'Inicio de sesión fallido',
      now,
    });

    expect(signals.map((s) => s.id)).toEqual([
      'readiness',
      'incident',
      'auth_blocked',
    ]);
    expect(signals[0]?.label).toContain('2 pendientes');
    expect(signals[1]?.label).toContain('Inicio de sesión fallido');
  });

  it('ignores incidents outside the window', () => {
    const signals = buildOperatorAttentionSignals({
      productionReady: true,
      missingCount: 0,
      missingLabels: [],
      allowsAuthentication: true,
      lastIncidentAt: '2026-01-01T12:00:00.000Z',
      lastIncidentLabel: 'Permiso denegado',
      now,
    });
    expect(signals).toEqual([]);
  });
});
