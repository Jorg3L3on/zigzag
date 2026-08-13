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
 */
export const resolveTeamSwitcherCompany = <T extends TeamSwitcherCompanyFields>({
  teams,
  selectedCompany,
  sessionCompanyId,
}: {
  teams: T[];
  selectedCompany: T | null;
  sessionCompanyId?: number | null;
}): T | null => {
  if (teams.length === 0) {
    return selectedCompany;
  }

  if (selectedCompany) {
    const match = teams.find((team) => team.id === selectedCompany.id);
    if (match) {
      return match;
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
