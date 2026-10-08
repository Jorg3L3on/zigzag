import { describe, expect, it } from '@jest/globals';
import {
  filterTeamMembers,
  teamMemberInitials,
  teamMemberStatusLabel,
  type TeamMember,
} from '@/lib/team-members';

const member = (overrides: Partial<TeamMember>): TeamMember => ({
  id: '1',
  name: 'Ana Administradora',
  email: 'ana@demo.mx',
  roleId: 1,
  roleName: 'Admin',
  emailVerified: true,
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
});
