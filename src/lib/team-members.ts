/** A member of the caller's company as the Equipo tab shows it (no company columns). */
export type TeamMember = {
  /** User id as a string (bigint does not cross the client boundary cleanly). */
  id: string;
  name: string;
  email: string;
  roleId: number | null;
  roleName: string | null;
  emailVerified: boolean;
  /** Set by an admin's temporary password until the person picks their own (ZIG-I18-11). */
  mustChangePassword: boolean;
  /** Deactivated (soft-deleted) members only show in the desktop Todos view (ZIG-I32-2). */
  deactivated: boolean;
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

/** Acceso column on md+ (ZIG-I32-2). There is no email verification, so no «Sin verificar». */
export type TeamMemberAccess = 'active' | 'must_change_password' | 'deactivated';

export const teamMemberAccess = (
  member: Pick<TeamMember, 'deactivated' | 'mustChangePassword'>,
): TeamMemberAccess =>
  member.deactivated
    ? 'deactivated'
    : member.mustChangePassword
      ? 'must_change_password'
      : 'active';

export const TEAM_ACCESS_LABELS: Record<TeamMemberAccess, string> = {
  active: 'Activo',
  must_change_password: 'Debe cambiar contraseña',
  deactivated: 'Desactivado',
};

export type TeamAccessFilter = 'active' | 'all';

export const TEAM_ACCESS_FILTERS: Array<{ value: TeamAccessFilter; label: string }> = [
  { value: 'active', label: 'Activos' },
  { value: 'all', label: 'Todos' },
];

/** ZigZag's shared role templates keep English names in the database. */
const SHARED_ROLE_LABELS: Record<string, string> = {
  Admin: 'Admin',
  Operator: 'Operador',
  Viewer: 'Solo lectura',
};

export const teamRoleLabel = (name: string | null): string =>
  name ? (SHARED_ROLE_LABELS[name] ?? name) : 'Sin rol';

export type TeamRoleTone = 'admin' | 'operator' | 'viewer' | 'other';

export const teamRoleTone = (name: string | null): TeamRoleTone =>
  name === 'Admin'
    ? 'admin'
    : name === 'Operator'
      ? 'operator'
      : name === 'Viewer'
        ? 'viewer'
        : 'other';

/** «2 Admin · 1 Operador · 2 Solo lectura»: active members per role, most first. */
export const summarizeTeamRoles = (members: TeamMember[]): string => {
  const counts = new Map<string, number>();
  for (const member of members) {
    if (member.deactivated) continue;
    const label = teamRoleLabel(member.roleName);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([label, count]) => `${count} ${label}`)
    .join(' · ');
};

/** Desktop filters: name or email, a role id, and Activos / Todos. */
export const filterTeamMembersDesktop = (
  members: TeamMember[],
  options: { search: string; roleId: number | null; access: TeamAccessFilter },
): TeamMember[] => {
  const query = normalize(options.search);
  return members.filter((member) => {
    if (options.access === 'active' && member.deactivated) {
      return false;
    }
    if (options.roleId !== null && member.roleId !== options.roleId) {
      return false;
    }
    if (!query) {
      return true;
    }
    return [member.name, member.email].some((field) => normalize(field).includes(query));
  });
};
