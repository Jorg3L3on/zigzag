import { resolveOperatorPrimaryCta } from '@/lib/operator-primary-cta';

describe('resolveOperatorPrimaryCta', () => {
  const base = {
    companyId: 10,
    editHref: '/companies/10/edit',
  };

  it('asks to complete go-live when setup and not ready', () => {
    expect(
      resolveOperatorPrimaryCta({
        ...base,
        lifecycle: 'SETUP',
        productionReady: false,
      }),
    ).toEqual({
      kind: 'complete_go_live',
      label: 'Completar go-live',
      href: '/companies/10/edit?tenant_company_id=10',
    });
  });

  it('activates when setup and production ready', () => {
    expect(
      resolveOperatorPrimaryCta({
        ...base,
        lifecycle: 'SETUP',
        productionReady: true,
      }),
    ).toEqual({
      kind: 'activate',
      label: 'Activar empresa',
      lifecycleTarget: 'ACTIVE',
    });
  });

  it('opens dashboard when active', () => {
    expect(
      resolveOperatorPrimaryCta({
        ...base,
        lifecycle: 'ACTIVE',
        productionReady: true,
      }),
    ).toEqual({
      kind: 'open_dashboard',
      label: 'Abrir dashboard',
      href: '/dashboard?tenant_company_id=10',
    });
  });

  it('restores access when suspended', () => {
    expect(
      resolveOperatorPrimaryCta({
        ...base,
        lifecycle: 'SUSPENDED',
        productionReady: false,
      }),
    ).toEqual({
      kind: 'restore_access',
      label: 'Restaurar acceso',
      lifecycleTarget: 'ACTIVE',
    });
  });

  it('falls back to edit for archived', () => {
    expect(
      resolveOperatorPrimaryCta({
        ...base,
        lifecycle: 'ARCHIVED',
        productionReady: false,
      }),
    ).toEqual({
      kind: 'edit_company',
      label: 'Editar empresa',
      href: '/companies/10/edit?tenant_company_id=10',
    });
  });
});
