import type { Company } from '@/db/schema';
import {
  buildCompanyOperatorSummary,
  getEntitlementPressure,
  worstEntitlementPressure,
} from '@/lib/company-operator-summary';
import type { EntitlementUsage } from '@/lib/company-entitlements';

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
  settings: { rfc: 'ACM010101AAA', default_currency: 'MXN', plan: 'starter' },
  created_at: new Date(),
  updated_at: null,
  deleted_at: null,
  ...overrides,
});

const emptyUsage = (): EntitlementUsage => ({
  users: 0,
  clients: 0,
  services: 0,
  tickets_month: 0,
});

describe('company operator summary', () => {
  it('derives setup lifecycle and readiness blockers', () => {
    const summary = buildCompanyOperatorSummary(
      baseCompany({ status: 'SETUP', settings: null }),
      emptyUsage(),
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
      emptyUsage(),
      2,
    );

    expect(summary.lifecycle).toBe('ACTIVE');
    expect(summary.readiness.productionReady).toBe(true);
  });

  it('reflects suspended lifecycle and blocked authentication semantics', () => {
    const summary = buildCompanyOperatorSummary(
      baseCompany({ status: 'SUSPENDED' }),
      emptyUsage(),
      1,
    );

    expect(summary.lifecycle).toBe('SUSPENDED');
    expect(summary.allowsAuthentication).toBe(false);
    expect(summary.readiness.productionReady).toBe(false);
  });

  it('reflects archived lifecycle', () => {
    const summary = buildCompanyOperatorSummary(
      baseCompany({ status: 'ARCHIVED' }),
      emptyUsage(),
      0,
    );

    expect(summary.lifecycle).toBe('ARCHIVED');
    expect(summary.allowsAuthentication).toBe(false);
  });

  it('flags near-limit and at-limit plan pressure', () => {
    expect(getEntitlementPressure(10, 8)).toBe('near_limit');
    expect(getEntitlementPressure(10, 10)).toBe('at_limit');
    expect(getEntitlementPressure(null, 100)).toBe('unlimited');
    expect(worstEntitlementPressure(['ok', 'near_limit', 'unlimited'])).toBe(
      'near_limit',
    );
    expect(worstEntitlementPressure(['ok', 'at_limit'])).toBe('at_limit');
  });

  it('marks starter plan over user limit as at_limit overall pressure', () => {
    const summary = buildCompanyOperatorSummary(
      baseCompany({ status: 'ACTIVE', settings: { plan: 'starter' } }),
      {
        users: 3,
        clients: 0,
        services: 0,
        tickets_month: 0,
      },
      1,
    );

    const usersMetric = summary.metrics.find((row) => row.metric === 'users');
    expect(usersMetric?.pressure).toBe('at_limit');
    expect(usersMetric?.allowed).toBe(false);
    expect(summary.overallPressure).toBe('at_limit');
  });

  it('scopes metric deep links to tenant resource lists', () => {
    const summary = buildCompanyOperatorSummary(
      baseCompany(),
      emptyUsage(),
      0,
    );

    expect(summary.metrics.map((row) => row.href)).toEqual([
      '/dashboard/users',
      '/dashboard/clients',
      '/dashboard/services',
      '/dashboard/tickets',
    ]);
    expect(summary.editHref).toBe('/dashboard/companies/10/edit');
  });
});
