import type { Company } from '@/db/schema';
import { buildOperatorFleetRow } from '@/lib/company-operator-fleet';
import { assessCompanyProfile } from '@/lib/company-readiness';

const baseCompany = (overrides: Partial<Company> = {}): Company => ({
  id: 10,
  name: 'Acme',
  phone: '555',
  email: 'ops@acme.test',
  logo: null,
  is_system: false,
  street: 'Main',
  interior_number: null,
  exterior_number: '100',
  neighborhood: 'Centro',
  city: 'CDMX',
  state: 'CDMX',
  country: 'México',
  postal_code: '01000',
  status: 'SETUP',
  settings: { rfc: 'ACM010101AAA', default_currency: 'MXN' },
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: null,
  deleted_at: null,
  ...overrides,
});

const now = new Date('2026-11-11T12:00:00.000Z');

describe('operator fleet row (ZIG-I38-1)', () => {
  it('counts only profile gaps: suspended or archived with a full profile has 0 pending (E3)', () => {
    for (const status of ['SUSPENDED', 'ARCHIVED'] as const) {
      const row = buildOperatorFleetRow(baseCompany({ status }), undefined, now);
      expect(row.profile.missing).toBe(0);
      expect(row.profile.missingLabels).toEqual([]);
    }
  });

  it('groups the 12 profile fields in Contacto, Dirección and Datos fiscales', () => {
    const profile = assessCompanyProfile(
      baseCompany({ settings: null, postal_code: '' }),
    );
    expect(profile.total).toBe(12);
    expect(profile.done).toBe(9);
    expect(profile.groups.map((group) => group.label)).toEqual([
      'Contacto',
      'Dirección',
      'Datos fiscales',
    ]);
    expect(profile.missingLabels).toEqual([
      'Código postal',
      'RFC en configuración',
      'Moneda por defecto',
    ]);
  });

  it('marks a setup company with a full profile as ready to activate', () => {
    const row = buildOperatorFleetRow(baseCompany({ status: 'SETUP' }), undefined, now);
    expect(row.attention.map((reason) => reason.id)).toEqual(['ready_to_activate']);
    expect(row.needsAttention).toBe(true);
  });

  it('uses the last sign-in of a company user, not the last audit event (E11)', () => {
    const signIn = new Date('2026-11-10T08:00:00.000Z');
    const row = buildOperatorFleetRow(
      baseCompany({ status: 'ACTIVE' }),
      { peopleCount: 4, lastSignInAt: signIn, alert: null, statusSince: null },
      now,
    );
    expect(row.lastSignInAt).toBe(signIn.toISOString());
    expect(row.peopleCount).toBe(4);
    expect(row.needsAttention).toBe(false);
  });

  it('gives an archived company its retention end, 90 days after archiving', () => {
    const archivedAt = new Date('2026-10-16T00:00:00.000Z');
    const row = buildOperatorFleetRow(
      baseCompany({ status: 'ARCHIVED' }),
      { peopleCount: 2, lastSignInAt: null, alert: null, statusSince: archivedAt },
      now,
    );
    expect(row.retentionEndsAt).toBe('2027-01-14T00:00:00.000Z');
    expect(row.statusSince).toBe(archivedAt.toISOString());
  });
});
