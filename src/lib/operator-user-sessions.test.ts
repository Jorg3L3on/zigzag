import { buildOperatorUserSessionRows } from '@/lib/operator-user-sessions';

describe('buildOperatorUserSessionRows', () => {
  it('sorts by last sign-in descending and puts nulls last', () => {
    const rows = buildOperatorUserSessionRows([
      {
        id: 1,
        name: 'Zoe',
        email: 'zoe@test',
        lastSignedInAt: null,
      },
      {
        id: 2n,
        name: 'Ana',
        email: 'ana@test',
        lastSignedInAt: '2026-08-10T12:00:00.000Z',
      },
      {
        id: '3',
        name: 'Bea',
        email: 'bea@test',
        lastSignedInAt: new Date('2026-08-12T08:00:00.000Z'),
      },
    ]);

    expect(rows.map((row) => row.name)).toEqual(['Bea', 'Ana', 'Zoe']);
    expect(rows[0]?.lastSignedInAt?.toISOString()).toBe(
      '2026-08-12T08:00:00.000Z',
    );
    expect(rows[2]?.lastSignedInAt).toBeNull();
    expect(rows[0]?.id).toBe('3');
  });

  it('ties break by name when timestamps match', () => {
    const stamp = '2026-08-01T00:00:00.000Z';
    const rows = buildOperatorUserSessionRows([
      { id: 1, name: 'Carlos', email: 'c@t', lastSignedInAt: stamp },
      { id: 2, name: 'Ana', email: 'a@t', lastSignedInAt: stamp },
    ]);
    expect(rows.map((row) => row.name)).toEqual(['Ana', 'Carlos']);
  });
});
