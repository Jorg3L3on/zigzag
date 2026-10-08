import { describe, expect, it } from '@jest/globals';
import {
  COMPANY_HUB_TABS,
  filterCompanyHubTabs,
  getActiveCompanyHubTab,
  getCompanyHubSubpage,
  getCompanyHubTabLabel,
} from '@/lib/company-hub';

describe('company-hub', () => {
  it('orders tabs Datos · Equipo · Roles with their permissions', () => {
    expect(
      COMPANY_HUB_TABS.map((tab) => [tab.label, tab.href, tab.requiredPermission]),
    ).toEqual([
      ['Datos', '/company', 'company.manage'],
      ['Equipo', '/company/equipo', 'users.read'],
      ['Roles', '/company/roles', 'roles.read'],
    ]);
  });

  it('resolves the active tab from the pathname', () => {
    expect(getActiveCompanyHubTab('/company')).toBe('datos');
    expect(getActiveCompanyHubTab('/company/equipo')).toBe('equipo');
    expect(getActiveCompanyHubTab('/company/roles')).toBe('roles');
    expect(getActiveCompanyHubTab('/company/roles/12')).toBe('roles');
    expect(getActiveCompanyHubTab('/companies')).toBeNull();
    expect(getActiveCompanyHubTab('/users')).toBeNull();
  });

  it('labels the breadcrumb with the active tab', () => {
    expect(getCompanyHubTabLabel('/company/equipo')).toBe('Equipo');
    expect(getCompanyHubTabLabel('/dashboard')).toBeNull();
  });

  it('hides tabs the caller cannot read', () => {
    const can = (permission: string) => permission !== 'roles.read';
    expect(filterCompanyHubTabs(can).map((tab) => tab.key)).toEqual([
      'datos',
      'equipo',
    ]);
  });

  it('detects the full-screen role editor routes', () => {
    expect(getCompanyHubSubpage('/company/roles/nuevo')?.title).toBe('Nuevo rol');
    expect(getCompanyHubSubpage('/company/roles/12')).toEqual({
      title: 'Editar rol',
      backHref: '/company/roles',
      backLabel: 'Volver a roles',
    });
    expect(getCompanyHubSubpage('/company/roles')).toBeNull();
    expect(getCompanyHubSubpage('/company/equipo')).toBeNull();
  });
});
