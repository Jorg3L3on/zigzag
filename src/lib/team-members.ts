/** A member of the caller's company as the Equipo tab shows it (no company columns). */
export type TeamMember = {
  /** User id as a string (bigint does not cross the client boundary cleanly). */
  id: string;
  name: string;
  email: string;
  roleId: number | null;
  roleName: string | null;
  /** Kept for the record; there is no email verification step, so nothing shows it (ZIG-I32). */
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

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export const teamMemberInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
};

/** Acceso on every layout (ZIG-I32). There is no email verification, so no «Sin verificar». */
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

/** «2 Admin · 1 Operador · 2 Solo lectura»: active members per role, templates first. */
export const summarizeTeamRoles = (members: TeamMember[]): string => {
  const counts = new Map<string, number>();
  for (const member of members) {
    if (member.deactivated) continue;
    const label = teamRoleLabel(member.roleName);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const templateOrder = Object.values(SHARED_ROLE_LABELS);
  const rank = (label: string) => {
    const index = templateOrder.indexOf(label);
    return index === -1 ? templateOrder.length : index;
  };
  return [...counts.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'es'))
    .map(([label, count]) => `${count} ${label}`)
    .join(' · ');
};

/** One line per shared template in the Agregar persona role picker (canvas EmpEquipo). */
const SHARED_ROLE_PICKER_HINTS: Record<string, string> = {
  Admin: 'Todo, incluido equipo, roles y Mi empresa',
  Operator: 'Tickets, cobranza, presupuestos, clientes y servicios',
  Viewer: 'Ve tickets, clientes y servicios; no edita',
};

/** Role options as the pickers show them: Spanish names, one line per shared template. */
export const teamRolePickerOptions = (roles: TeamRoleOption[]): TeamRoleOption[] =>
  roles.map((role) => ({
    ...role,
    name: teamRoleLabel(role.name),
    description: SHARED_ROLE_PICKER_HINTS[role.name] ?? role.description,
  }));

/** Initials tint on md+ (canvas EmpEquipo): stable per name, solid for yourself. */
const AVATAR_TINTS = [
  'bg-blue-500/15 text-blue-800 dark:text-blue-200',
  'bg-amber-500/20 text-amber-900 dark:text-amber-200',
  'bg-indigo-500/15 text-indigo-800 dark:text-indigo-200',
  'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
  'bg-rose-500/15 text-rose-800 dark:text-rose-200',
  'bg-slate-500/15 text-slate-700 dark:text-slate-200',
];

export const teamAvatarTint = (member: Pick<TeamMember, 'name' | 'isSelf'>): string => {
  if (member.isSelf) {
    return 'bg-primary text-primary-foreground';
  }
  let hash = 0;
  for (const char of member.name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
};

/**
 * Name, email or role search, an optional role id, and Activos / Todos
 * (Todos adds deactivated members). Accents and case are ignored.
 */
export const filterTeamMembers = (
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
    return [member.name, member.email, teamRoleLabel(member.roleName), member.roleName ?? ''].some(
      (field) => normalize(field).includes(query),
    );
  });
};
