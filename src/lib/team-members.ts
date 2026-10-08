/** A member of the caller's company as the Equipo tab shows it (no company columns). */
export type TeamMember = {
  /** User id as a string (bigint does not cross the client boundary cleanly). */
  id: string;
  name: string;
  email: string;
  roleId: number | null;
  roleName: string | null;
  emailVerified: boolean;
  createdAt: string;
  isSelf: boolean;
};

export type TeamRoleOption = {
  id: number;
  name: string;
  description: string | null;
};

export type TeamStatusFilter = 'all' | 'active' | 'unverified';

export const TEAM_STATUS_FILTERS: Array<{ value: TeamStatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'unverified', label: 'Sin verificar' },
];

export const teamMemberStatusLabel = (member: Pick<TeamMember, 'emailVerified'>) =>
  member.emailVerified ? 'Activo' : 'Sin verificar';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Search by name, email or role; status chips split verified from unverified. */
export const filterTeamMembers = (
  members: TeamMember[],
  search: string,
  status: TeamStatusFilter,
): TeamMember[] => {
  const query = normalize(search);
  return members.filter((member) => {
    if (status === 'active' && !member.emailVerified) {
      return false;
    }
    if (status === 'unverified' && member.emailVerified) {
      return false;
    }
    if (!query) {
      return true;
    }
    return [member.name, member.email, member.roleName ?? ''].some((field) =>
      normalize(field).includes(query),
    );
  });
};

export const teamMemberInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
};
