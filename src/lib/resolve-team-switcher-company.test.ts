import {
  resolveTeamSwitcherCompany,
  teamSwitcherCompanyNeedsUpdate,
} from '@/lib/resolve-team-switcher-company';

const team = (
  id: number,
  overrides: Partial<{
    name: string;
    logoUrl: string | null;
    plan: string;
    is_system: boolean;
  }> = {},
) => ({
  id,
  name: overrides.name ?? `Company ${id}`,
  logoUrl: overrides.logoUrl ?? null,
  plan: overrides.plan ?? 'Enterprise',
  is_system: overrides.is_system ?? false,
});

describe('resolveTeamSwitcherCompany', () => {
  const system = team(1, { name: 'System', is_system: true });
  const acme = team(2, { name: 'Acme' });
  const beta = team(3, { name: 'Beta' });
  const teams = [system, acme, beta];

  it('keeps the selected company when it is still in the teams list', () => {
    expect(
      resolveTeamSwitcherCompany({
        teams,
        selectedCompany: beta,
        sessionCompanyId: system.id,
      }),
    ).toEqual(beta);
  });

  it('refreshes selected company fields from the teams list by id', () => {
    const stale = team(3, { name: 'Old Beta', logoUrl: '/old.png' });
    const resolved = resolveTeamSwitcherCompany({
      teams,
      selectedCompany: stale,
      sessionCompanyId: system.id,
    });
    expect(resolved).toEqual(beta);
  });

  it('falls back to the session company when nothing is selected', () => {
    expect(
      resolveTeamSwitcherCompany({
        teams,
        selectedCompany: null,
        sessionCompanyId: system.id,
      }),
    ).toEqual(system);
  });

  it('falls back to the session company when selection is no longer available', () => {
    const gone = team(99, { name: 'Removed' });
    expect(
      resolveTeamSwitcherCompany({
        teams,
        selectedCompany: gone,
        sessionCompanyId: acme.id,
      }),
    ).toEqual(acme);
  });

  it('falls back to the first team when session company is missing', () => {
    expect(
      resolveTeamSwitcherCompany({
        teams,
        selectedCompany: null,
        sessionCompanyId: 999,
      }),
    ).toEqual(system);
  });

  it('preserves selection while teams are still loading', () => {
    expect(
      resolveTeamSwitcherCompany({
        teams: [],
        selectedCompany: beta,
        sessionCompanyId: system.id,
      }),
    ).toEqual(beta);
  });
});

describe('teamSwitcherCompanyNeedsUpdate', () => {
  it('returns false when identity fields are unchanged', () => {
    const a = team(2, { name: 'Acme', logoUrl: '/a.png' });
    const b = team(2, { name: 'Acme', logoUrl: '/a.png' });
    expect(teamSwitcherCompanyNeedsUpdate(a, b)).toBe(false);
  });

  it('returns true when the selected company id changes', () => {
    expect(teamSwitcherCompanyNeedsUpdate(team(2), team(3))).toBe(true);
  });

  it('returns true when brand metadata changes for the same id', () => {
    expect(
      teamSwitcherCompanyNeedsUpdate(
        team(2, { name: 'Acme' }),
        team(2, { name: 'Acme Corp' }),
      ),
    ).toBe(true);
  });
});
