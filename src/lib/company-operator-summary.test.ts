import type { Company } from '@/db/schema';
import { buildCompanyOperatorSummary } from '@/lib/company-operator-summary';

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

describe('company operator summary', () => {
  it('derives setup lifecycle and readiness blockers', () => {
    const summary = buildCompanyOperatorSummary(
      baseCompany({ status: 'SETUP', settings: null }),
      1,
    );

    expect(summary.lifecycle).toBe('SETUP');
    expect(summary.readiness.productionReady).toBe(false);
    expect(summary.readiness.missing.length).toBeGreaterThan(0);
    expect(summary.allowsAuthentication).toBe(true);
  });

  it('marks active tenants with complete profile as production ready', () => {
    const summary = buildCompanyOperatorSummary(
      baseCompany({ status: 'ACTIVE' }),
      2,
    );

    expect(summary.lifecycle).toBe('ACTIVE');
    expect(summary.readiness.productionReady).toBe(true);
  });

  it('reflects suspended lifecycle and blocked authentication semantics', () => {
    const summary = buildCompanyOperatorSummary(
      baseCompany({ status: 'SUSPENDED' }),
      1,
    );

    expect(summary.lifecycle).toBe('SUSPENDED');
    expect(summary.allowsAuthentication).toBe(false);
    expect(summary.readiness.productionReady).toBe(false);
  });

  it('reflects archived lifecycle', () => {
    const summary = buildCompanyOperatorSummary(
      baseCompany({ status: 'ARCHIVED' }),
      0,
    );

    expect(summary.lifecycle).toBe('ARCHIVED');
    expect(summary.allowsAuthentication).toBe(false);
  });

  it('includes edit href and role count', () => {
    const summary = buildCompanyOperatorSummary(baseCompany(), 3);

    expect(summary.roleCount).toBe(3);
    expect(summary.editHref).toBe('/companies/10/edit');
  });
});
