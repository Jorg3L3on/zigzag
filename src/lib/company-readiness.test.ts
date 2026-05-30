import type { Company } from '@/db/schema';
import {
  assessCompanyReadiness,
  listCompanyProfileGaps,
} from '@/lib/company-readiness';

const baseCompany = (): Company => ({
  id: 1,
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
});

describe('company readiness', () => {
  it('flags missing profile and lifecycle requirements for setup tenants', () => {
    const row = baseCompany();
    row.settings = null;

    const assessment = assessCompanyReadiness(row);

    expect(assessment.profileReady).toBe(false);
    expect(assessment.productionReady).toBe(false);
    expect(assessment.missing).toEqual(
      expect.arrayContaining(['settings.rfc', 'settings.default_currency', 'lifecycle.active']),
    );
  });

  it('marks active tenants with complete profiles as production ready', () => {
    const row = baseCompany();
    row.status = 'ACTIVE';

    const assessment = assessCompanyReadiness(row);

    expect(listCompanyProfileGaps(row)).toEqual([]);
    expect(assessment.productionReady).toBe(true);
  });

  it('blocks production even with a complete profile while suspended', () => {
    const row = baseCompany();
    row.status = 'SUSPENDED';

    const assessment = assessCompanyReadiness(row);

    expect(assessment.profileReady).toBe(true);
    expect(assessment.productionReady).toBe(false);
    expect(assessment.missing).toContain('lifecycle.active');
  });
});
