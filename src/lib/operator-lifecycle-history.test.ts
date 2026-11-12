import { buildLifecycleHistory } from '@/lib/operator-lifecycle-history';

const row = (overrides: Partial<Parameters<typeof buildLifecycleHistory>[0][number]>) => ({
  id: 1,
  at: new Date('2026-03-05T12:00:00.000Z'),
  action: 'updated',
  before_status: 'SETUP',
  after_status: 'ACTIVE',
  reason: null,
  actor_name: 'Operador ZigZag',
  actor_company_id: 1,
  target_company_id: 12,
  ...overrides,
});

describe('buildLifecycleHistory (ZIG-I38-7)', () => {
  it('keeps status changes and the creation, newest first, with the reason', () => {
    const history = buildLifecycleHistory([
      row({ id: 1, action: 'created', before_status: null, after_status: 'SETUP', at: new Date('2026-03-03T12:00:00.000Z') }),
      row({ id: 2, before_status: 'SETUP', after_status: 'ACTIVE', reason: 'Perfil completo' }),
      row({ id: 3, before_status: 'ACTIVE', after_status: 'ACTIVE', at: new Date('2026-04-01T12:00:00.000Z') }),
      row({ id: 4, before_status: 'ACTIVE', after_status: 'SUSPENDED', reason: 'Falta de pago', at: new Date('2026-05-01T12:00:00.000Z') }),
    ]);
    expect(history.map((entry) => [entry.title, entry.change, entry.reason])).toEqual([
      ['Suspendida', 'Activa a Suspendida', 'Falta de pago'],
      ['Activada', 'En configuración a Activa', 'Perfil completo'],
      ['Empresa creada', 'En configuración', null],
    ]);
    expect(history[0].operator).toBe(true);
  });

  it('names a restore', () => {
    expect(
      buildLifecycleHistory([row({ before_status: 'SUSPENDED', after_status: 'ACTIVE' })])[0].title,
    ).toBe('Acceso restaurado');
  });
});
