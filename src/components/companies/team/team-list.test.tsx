import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TeamList } from '@/components/companies/team/team-list';
import { addTeamMember, getTeam } from '@/actions/team';
import type { TeamData } from '@/actions/team';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock('@/actions/team', () => ({
  getTeam: jest.fn(),
  addTeamMember: jest.fn(),
  updateTeamMember: jest.fn(),
  changeTeamMemberRole: jest.fn(),
  deactivateTeamMember: jest.fn(),
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockGetTeam = getTeam as jest.MockedFunction<typeof getTeam>;
const mockAddTeamMember = addTeamMember as jest.MockedFunction<typeof addTeamMember>;

const teamData = (overrides: Partial<TeamData> = {}): TeamData => ({
  members: [
    {
      id: '1',
      name: 'Ana Admin',
      email: 'ana@demo.mx',
      roleId: 1,
      roleName: 'Admin',
      emailVerified: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      isSelf: true,
    },
    {
      id: '2',
      name: 'Carlos Técnico',
      email: 'carlos@demo.mx',
      roleId: 2,
      roleName: 'Operator',
      emailVerified: false,
      createdAt: '2026-10-02T00:00:00.000Z',
      isSelf: false,
    },
  ],
  roles: [
    { id: 1, name: 'Admin', description: 'Todo, incluido el equipo' },
    { id: 2, name: 'Operator', description: 'Trabaja tickets y clientes' },
  ],
  canWrite: true,
  ...overrides,
});

describe('TeamList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists members without company columns', async () => {
    mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
    render(<TeamList />);

    expect(await screen.findAllByText('Carlos Técnico')).not.toHaveLength(0);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers.join(' ')).toMatch(/Usuario.*Rol.*Estado.*Alta/);
    expect(headers.join(' ')).not.toMatch(/Empresa|ID/);
  });

  it('filters by the Sin verificar chip', async () => {
    mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
    render(<TeamList />);
    await screen.findAllByText('Ana Admin');

    fireEvent.click(screen.getByRole('button', { name: 'Sin verificar' }));

    await waitFor(() => {
      expect(screen.queryAllByText('Ana Admin')).toHaveLength(0);
    });
    expect(screen.getAllByText('Carlos Técnico').length).toBeGreaterThan(0);
  });

  it('hides write actions for read-only viewers', async () => {
    mockGetTeam.mockResolvedValue({
      success: true,
      data: teamData({ canWrite: false }),
    });
    render(<TeamList />);
    await screen.findAllByText('Ana Admin');

    expect(screen.queryByRole('button', { name: /Agregar usuario/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Acciones de/ })).toBeNull();
  });

  it('adds a member with the chosen role', async () => {
    mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
    mockAddTeamMember.mockResolvedValue({ success: true });
    render(<TeamList />);
    await screen.findAllByText('Ana Admin');

    fireEvent.click(screen.getAllByRole('button', { name: /Agregar usuario/ })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre'), {
      target: { value: 'Lucía' },
    });
    fireEvent.change(within(dialog).getByLabelText('Correo electrónico'), {
      target: { value: 'lucia@demo.mx' },
    });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Operator/ }));
    fireEvent.change(within(dialog).getByLabelText('Contraseña inicial'), {
      target: { value: 'secreta123' },
    });
    fireEvent.change(within(dialog).getByLabelText('Confirmar contraseña'), {
      target: { value: 'secreta123' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agregar usuario' }));

    await waitFor(() => {
      expect(mockAddTeamMember).toHaveBeenCalledWith({
        name: 'Lucía',
        email: 'lucia@demo.mx',
        role_id: 2,
        password: 'secreta123',
      });
    });
  });

  it('requires a role before adding', async () => {
    mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
    render(<TeamList />);
    await screen.findAllByText('Ana Admin');

    fireEvent.click(screen.getAllByRole('button', { name: /Agregar usuario/ })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre'), {
      target: { value: 'Lucía' },
    });
    fireEvent.change(within(dialog).getByLabelText('Correo electrónico'), {
      target: { value: 'lucia@demo.mx' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agregar usuario' }));

    expect(await within(dialog).findByText('Elige un rol')).toBeInTheDocument();
    expect(mockAddTeamMember).not.toHaveBeenCalled();
  });

  it('shows a retry state when loading fails', async () => {
    mockGetTeam.mockResolvedValue({
      success: false,
      error: 'No se pudieron cargar los usuarios. Código: US001',
    });
    render(<TeamList />);

    expect(await screen.findByText('No se pudo cargar el equipo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
