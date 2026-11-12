import { resolveOperatorPrimaryCta } from '@/lib/operator-primary-cta';

describe('resolveOperatorPrimaryCta (ZIG-I38 E2/E7)', () => {
  const base = { companyId: 10, editHref: '/companies/10/edit' };

  it('asks to complete the profile when setup and the profile has gaps', () => {
    expect(
      resolveOperatorPrimaryCta({ ...base, lifecycle: 'SETUP', profileReady: false }),
    ).toEqual({
      kind: 'complete_profile',
      label: 'Completar datos',
      href: '/companies/10/edit?tenant_company_id=10',
    });
  });

  it('offers «Activar empresa» when setup with a complete profile', () => {
    expect(
      resolveOperatorPrimaryCta({ ...base, lifecycle: 'SETUP', profileReady: true }),
    ).toEqual({ kind: 'activate', label: 'Activar empresa', lifecycleTarget: 'ACTIVE' });
  });

  it('operates as the company when active', () => {
    expect(
      resolveOperatorPrimaryCta({ ...base, lifecycle: 'ACTIVE', profileReady: true }),
    ).toMatchObject({ kind: 'operate_as', label: 'Operar como esta empresa' });
  });

  it('restores access when suspended', () => {
    expect(
      resolveOperatorPrimaryCta({ ...base, lifecycle: 'SUSPENDED', profileReady: true }),
    ).toEqual({ kind: 'restore_access', label: 'Restaurar acceso', lifecycleTarget: 'ACTIVE' });
  });

  it('has no primary button when archived', () => {
    expect(
      resolveOperatorPrimaryCta({ ...base, lifecycle: 'ARCHIVED', profileReady: true }),
    ).toBeNull();
  });
});
