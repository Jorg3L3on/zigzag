import {
  buildDashboardComposition,
  buildDashboardIntroSubtitle,
} from '@/lib/dashboard-composition';
import { resolveDashboardPersona } from '@/lib/dashboard-persona';
import { PERMISSIONS } from '@/lib/permissions';

const canOf = (granted: string[]) => (permission?: string) =>
  !permission || granted.includes(permission);

describe('dashboard persona + composition', () => {
  it('resolves system persona when a system user needs company context', () => {
    expect(
      resolveDashboardPersona({
        isSystem: true,
        needsCompanyContext: true,
        can: () => true,
      }),
    ).toBe('system');
  });

  it('treats system users with a selected tenant as admin', () => {
    expect(
      resolveDashboardPersona({
        isSystem: true,
        needsCompanyContext: false,
        can: () => true,
      }),
    ).toBe('admin');
  });

  it('resolves admin from users.write without role names', () => {
    expect(
      resolveDashboardPersona({
        isSystem: false,
        needsCompanyContext: false,
        can: canOf([PERMISSIONS.users.write, PERMISSIONS.tickets.write]),
      }),
    ).toBe('admin');
  });

  it('resolves operator from tickets.write without admin perms', () => {
    expect(
      resolveDashboardPersona({
        isSystem: false,
        needsCompanyContext: false,
        can: canOf([
          PERMISSIONS.tickets.read,
          PERMISSIONS.tickets.write,
          PERMISSIONS.clients.write,
        ]),
      }),
    ).toBe('operator');
  });

  it('resolves viewer as read-only', () => {
    expect(
      resolveDashboardPersona({
        isSystem: false,
        needsCompanyContext: false,
        can: canOf([PERMISSIONS.tickets.read, PERMISSIONS.clients.read]),
      }),
    ).toBe('viewer');
  });

  it('orders operator widgets operations-first and hides charts/exports', () => {
    const composition = buildDashboardComposition('operator');
    expect(composition.widgets.indexOf('operations')).toBeLessThan(
      composition.widgets.indexOf('kpis'),
    );
    expect(composition.widgets).not.toContain('charts');
    expect(composition.showExports).toBe(false);
    expect(composition.kpiKeys).toEqual([
      'activeTickets',
      'outstandingBalance',
    ]);
  });

  it('hides quick actions for viewers', () => {
    const composition = buildDashboardComposition('viewer');
    expect(composition.showQuickActions).toBe(false);
    expect(composition.widgets).not.toContain('quickActions');
    expect(composition.widgets).toContain('charts');
  });

  it('builds attention-aware intro subtitles', () => {
    expect(
      buildDashboardIntroSubtitle({
        persona: 'admin',
        attentionCount: 5,
        companyName: 'Acme',
      }),
    ).toBe('Tienes 5 pendientes que revisar');

    expect(
      buildDashboardIntroSubtitle({
        persona: 'operator',
        attentionCount: 0,
        companyName: 'Acme',
      }),
    ).toMatch(/Todo al día/i);
  });
});
