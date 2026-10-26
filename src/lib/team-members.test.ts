import { describe, expect, it } from '@jest/globals';
import {
  filterTeamMembers,
  filterTeamMembersDesktop,
  summarizeTeamRoles,
  teamMemberAccess,
  teamMemberInitials,
  teamMemberStatusLabel,
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
  it('filters by status chip', () => {
    expect(filterTeamMembers(team, '', 'all').map((m) => m.id)).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(filterTeamMembers(team, '', 'active').map((m) => m.id)).toEqual([
      '1',
      '3',
    ]);
    expect(filterTeamMembers(team, '', 'unverified').map((m) => m.id)).toEqual([
      '2',
    ]);
  });

  it('searches name, email and role, ignoring case and accents', () => {
    expect(filterTeamMembers(team, 'tecnico', 'all').map((m) => m.id)).toEqual([
      '2',
    ]);
    expect(filterTeamMembers(team, 'LUCIA@', 'all').map((m) => m.id)).toEqual([
      '3',
    ]);
    expect(filterTeamMembers(team, 'admin', 'unverified')).toEqual([]);
  });

  it('labels status and initials', () => {
    expect(teamMemberStatusLabel({ emailVerified: true })).toBe('Activo');
    expect(teamMemberStatusLabel({ emailVerified: false })).toBe('Sin verificar');
    expect(teamMemberInitials('Carlos  Operador ')).toBe('CO');
    expect(teamMemberInitials('viewer')).toBe('V');
    expect(teamMemberInitials('  ')).toBe('?');
  });

  describe('desktop Equipo (ZIG-I32-2)', () => {
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
      const ids = (options: Parameters<typeof filterTeamMembersDesktop>[1]) =>
        filterTeamMembersDesktop(desktopTeam, options).map((m) => m.id);
      expect(ids({ search: '', roleId: null, access: 'active' })).toEqual(['1', '2', '3']);
      expect(ids({ search: '', roleId: null, access: 'all' })).toEqual(['1', '2', '3', '4']);
      expect(ids({ search: '', roleId: 3, access: 'all' })).toEqual(['3', '4']);
      expect(ids({ search: 'LUCIA', roleId: null, access: 'active' })).toEqual(['3']);
    });
  });
});
