import { describe, expect, it } from '@jest/globals';
import {
  filterTeamMembers,
  summarizeTeamRoles,
  teamMemberAccess,
  teamMemberInitials,
  teamRoleLabel,
  type TeamMember,
} from '@/lib/team-members';

const member = (overrides: Partial<TeamMember>): TeamMember => ({
  id: '1',
  name: 'Ana Administradora',
  email: 'ana@demo.mx',
  roleId: 1,
  roleName: 'Admin',
  emailVerified: true,
  mustChangePassword: false,
  deactivated: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  isSelf: false,
  ...overrides,
});

const team = [
  member({ id: '1' }),
  member({
    id: '2',
    name: 'Carlos Operador',
    email: 'carlos@demo.mx',
    roleName: 'Técnico',
    emailVerified: false,
  }),
  member({ id: '3', name: 'Lucía', email: 'lucia@demo.mx', roleName: null }),
];

describe('team-members', () => {
  it('searches name, email and role (raw or in Spanish), ignoring case and accents', () => {
    const ids = (search: string) =>
      filterTeamMembers(team, { search, roleId: null, access: 'active' }).map((m) => m.id);
    expect(ids('tecnico')).toEqual(['2']);
    expect(ids('LUCIA@')).toEqual(['3']);
    expect(ids('admin')).toEqual(['1']);
  });

  it('makes initials', () => {
    expect(teamMemberInitials('Carlos  Operador ')).toBe('CO');
    expect(teamMemberInitials('viewer')).toBe('V');
    expect(teamMemberInitials('  ')).toBe('?');
  });

  describe('access states and filters (ZIG-I32)', () => {
    const desktopTeam = [
      member({ id: '1', roleId: 1, roleName: 'Admin' }),
      member({ id: '2', name: 'Carlos', email: 'c@demo.mx', roleId: 2, roleName: 'Operator', mustChangePassword: true }),
      member({ id: '3', name: 'Lucía', email: 'l@demo.mx', roleId: 3, roleName: 'Viewer' }),
      member({ id: '4', name: 'Beto', email: 'b@demo.mx', roleId: 3, roleName: 'Viewer', deactivated: true }),
    ];

    it('shows real access states and no «Sin verificar»', () => {
      expect(desktopTeam.map(teamMemberAccess)).toEqual([
        'active',
        'must_change_password',
        'active',
        'deactivated',
      ]);
      expect(teamMemberAccess({ mustChangePassword: true, deactivated: true })).toBe('deactivated');
    });

    it('names shared roles in Spanish and keeps custom ones', () => {
      expect(teamRoleLabel('Operator')).toBe('Operador');
      expect(teamRoleLabel('Viewer')).toBe('Solo lectura');
      expect(teamRoleLabel('Técnico de campo')).toBe('Técnico de campo');
      expect(teamRoleLabel(null)).toBe('Sin rol');
    });

    it('summarizes active members per role, most first', () => {
      expect(summarizeTeamRoles(desktopTeam)).toBe('1 Admin · 1 Operador · 1 Solo lectura');
      expect(summarizeTeamRoles([...desktopTeam, member({ id: '5', roleName: 'Viewer' })])).toBe(
        '2 Solo lectura · 1 Admin · 1 Operador',
      );
    });

    it('Activos hides deactivated members, Todos shows them; role and search narrow', () => {
      const ids = (options: Parameters<typeof filterTeamMembers>[1]) =>
        filterTeamMembers(desktopTeam, options).map((m) => m.id);
      expect(ids({ search: '', roleId: null, access: 'active' })).toEqual(['1', '2', '3']);
      expect(ids({ search: '', roleId: null, access: 'all' })).toEqual(['1', '2', '3', '4']);
      expect(ids({ search: '', roleId: 3, access: 'all' })).toEqual(['3', '4']);
      expect(ids({ search: 'LUCIA', roleId: null, access: 'active' })).toEqual(['3']);
    });
  });
});
