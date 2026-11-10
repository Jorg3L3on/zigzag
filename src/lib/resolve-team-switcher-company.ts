export type TeamSwitcherCompanyFields = {
  id: number;
  name: string;
  logoUrl: string | null;
  plan: string;
  is_system: boolean;
};

/**
 * Prefer the currently selected company when it is still in `teams`.
 * Only fall back to the session company (or first team) when there is no
 * valid selection — so navigation remounts do not wipe a manual switch.
 *
 * `teamsAuthoritative` is false while `teams` is only the session seed (the
 * sidebar has not loaded the real list yet). Then a selection that is not in
 * `teams` is kept as is: it is not known to be gone, only not loaded yet
 * (ZIG-I37-6). An empty selection may still be filled from the seed.
 */
export const resolveTeamSwitcherCompany = <T extends TeamSwitcherCompanyFields>({
  teams,
  selectedCompany,
  sessionCompanyId,
  teamsAuthoritative = true,
}: {
  teams: T[];
  selectedCompany: T | null;
  sessionCompanyId?: number | null;
  teamsAuthoritative?: boolean;
}): T | null => {
  if (teams.length === 0) {
    return selectedCompany;
  }

  if (selectedCompany) {
    const match = teams.find((team) => team.id === selectedCompany.id);
    if (match) {
      return match;
    }
    if (!teamsAuthoritative) {
      return selectedCompany;
    }
  }

  if (sessionCompanyId != null) {
    const userCompany = teams.find((team) => team.id === sessionCompanyId);
    if (userCompany) {
      return userCompany;
    }
  }

  return teams[0] ?? null;
};

export const teamSwitcherCompanyNeedsUpdate = (
  current: TeamSwitcherCompanyFields | null,
  next: TeamSwitcherCompanyFields | null,
): boolean => {
  if (current == null && next == null) {
    return false;
  }
  if (current == null || next == null) {
    return true;
  }
  return (
    current.id !== next.id ||
    current.name !== next.name ||
    current.logoUrl !== next.logoUrl ||
    current.plan !== next.plan ||
    current.is_system !== next.is_system
  );
};
