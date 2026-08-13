import type { Company } from '@/db/schema';
import {
  buildOperatorFleetRow,
  buildFleetIncidentSnapshot,
} from '@/lib/company-operator-fleet';

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
  created_at: new Date(),
  updated_at: null,
  deleted_at: null,
  ...overrides,
});

describe('company operator fleet mapper', () => {
  it('maps lifecycle, readiness, and audit snapshots', () => {
    const activityAt = new Date('2026-08-01T12:00:00.000Z');
    const incidentAt = new Date('2026-08-02T12:00:00.000Z');
    const incident = buildFleetIncidentSnapshot({
      occurred_at: incidentAt,
      action: 'sign_in_failed',
      result: 'denied',
      resource_type: 'auth',
      payload: null,
    });

    const row = buildOperatorFleetRow(baseCompany({ status: 'SETUP' }), {
      lastActivityAt: activityAt,
      lastIncidentAt: incident.lastIncidentAt,
      lastIncidentLabel: incident.lastIncidentLabel,
    });

    expect(row.lifecycle).toBe('SETUP');
    expect(row.lifecycleLabel).toBe('En configuración');
    expect(row.productionReady).toBe(false);
    expect(row.missingLabels).toContain('Estado operativo (Activa)');
    expect(row.lastActivityAt).toBe(activityAt.toISOString());
    expect(row.lastIncidentAt).toBe(incidentAt.toISOString());
    expect(row.lastIncidentLabel).toBe('Inicio de sesión fallido');
    expect(row.editHref).toBe('/companies/10/edit');
  });

  it('marks active complete profiles as production ready', () => {
    const row = buildOperatorFleetRow(baseCompany({ status: 'ACTIVE' }));
    expect(row.productionReady).toBe(true);
    expect(row.missingCount).toBe(0);
  });

  it('counts readiness gaps when profile is incomplete', () => {
    const row = buildOperatorFleetRow(
      baseCompany({ status: 'SETUP', settings: null, street: '' }),
    );
    expect(row.productionReady).toBe(false);
    expect(row.missingCount).toBeGreaterThan(0);
  });
});
