import type { Company } from '@/db/schema';
import {
  validateCompanyLifecycleChange,
  lifecycleOperationalImpact,
} from '@/lib/company-lifecycle-change';

const baseCompany = (overrides: Partial<Company> = {}): Company => ({
  id: 5,
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

describe('company lifecycle change', () => {
  it('blocks activation when readiness requirements are missing', () => {
    const result = validateCompanyLifecycleChange(
      baseCompany({ settings: null }),
      'ACTIVE',
    );

    expect(result.allowed).toBe(false);
    expect(result.missingLabels?.length).toBeGreaterThan(0);
  });

  it('allows activation when profile is complete', () => {
    const result = validateCompanyLifecycleChange(
      baseCompany({ status: 'SETUP' }),
      'ACTIVE',
    );

    expect(result.allowed).toBe(true);
    expect(result.operationalImpact).toContain('autenticarse');
  });

  it('describes suspend operational impact', () => {
    expect(lifecycleOperationalImpact('SUSPENDED')).toContain('no podrán iniciar sesión');
  });

  it('blocks transitions from archived companies', () => {
    const result = validateCompanyLifecycleChange(
      baseCompany({ status: 'ARCHIVED' }),
      'ACTIVE',
    );

    expect(result.allowed).toBe(false);
  });
});
