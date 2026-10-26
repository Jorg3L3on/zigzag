import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TeamList } from '@/components/companies/team/team-list';
import { addTeamMember, getTeam } from '@/actions/team';
import type { TeamData } from '@/actions/team';
import { useIsMobile } from '@/hooks/use-mobile';

jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: jest.fn(() => true) }));

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
const mockUseIsMobile = useIsMobile as jest.MockedFunction<typeof useIsMobile>;

const teamData = (overrides: Partial<TeamData> = {}): TeamData => ({
  members: [
    {
      id: '1',
      name: 'Ana Admin',
      email: 'ana@demo.mx',
      roleId: 1,
      roleName: 'Admin',
      emailVerified: true,
      mustChangePassword: false,
      deactivated: false,
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
      mustChangePassword: true,
      deactivated: false,
      createdAt: '2026-10-02T00:00:00.000Z',
      isSelf: false,
    },
  ],
  deactivated: [
    {
      id: '3',
      name: 'Beto Baja',
      email: 'beto@demo.mx',
      roleId: 2,
      roleName: 'Operator',
      emailVerified: true,
      mustChangePassword: false,
      deactivated: true,
      createdAt: '2026-09-02T00:00:00.000Z',
      isSelf: false,
    },
  ],
  companyName: 'ClimaTotal Demo',
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
    mockUseIsMobile.mockReturnValue(true);
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

  describe('desktop (ZIG-I32-2)', () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(false);
    });

    it('shows Persona · Rol · Acceso · Alta with real access states and no «Sin verificar»', async () => {
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      render(<TeamList />);
      const desktop = await screen.findByTestId('team-desktop');

      const headers = within(desktop).getAllByRole('columnheader').map((h) => h.textContent);
      expect(headers.join(' ')).toMatch(/Persona.*Rol.*Acceso.*Alta/);
      expect(headers.join(' ')).not.toMatch(/Empresa|ID/);
      expect(within(desktop).getByText('1 Admin · 1 Operador', { exact: false })).toBeInTheDocument();
      const access = within(desktop).getAllByTestId('team-member-access').map((el) => el.textContent);
      expect(access).toEqual(['Activo', 'Debe cambiar contraseña']);
      expect(within(desktop).queryByText('Sin verificar')).toBeNull();
      expect(within(desktop).getAllByText('Operador').length).toBeGreaterThan(0);
    });

    it('Activos hides deactivated members and Todos shows them with Desactivado', async () => {
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      render(<TeamList />);
      const desktop = await screen.findByTestId('team-desktop');
      expect(within(desktop).queryByText('Beto Baja')).toBeNull();

      fireEvent.click(within(desktop).getByRole('button', { name: 'Todos' }));

      const row = within(desktop).getByText('Beto Baja').closest('tr')!;
      expect(within(row).getByTestId('team-member-access')).toHaveTextContent('Desactivado');
      expect(within(row).queryByRole('button', { name: /Acciones de/ })).toBeNull();
    });

    it('offers Cambiar rol and Restablecer contraseña on the row, never reset for yourself', async () => {
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      render(<TeamList />);
      await screen.findByTestId('team-desktop');

      expect(screen.getByRole('button', { name: 'Restablecer contraseña de Carlos Técnico' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Restablecer contraseña de Ana Admin' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Cambiar rol de Ana Admin' })).toBeInTheDocument();
    });

    it('adds a person from the panel and shows the temporary password once', async () => {
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      mockAddTeamMember.mockResolvedValue({
        success: true,
        data: { temporaryPassword: 'kemo-7pdx' },
      });
      render(<TeamList />);
      await screen.findByTestId('team-desktop');

      fireEvent.click(screen.getByRole('button', { name: 'Agregar persona' }));
      const panel = await screen.findByTestId('team-member-panel');
      fireEvent.change(within(panel).getByLabelText('Nombre'), { target: { value: 'María' } });
      fireEvent.change(within(panel).getByLabelText('Correo electrónico'), {
        target: { value: 'maria@demo.mx' },
      });
      fireEvent.click(within(panel).getByRole('radio', { name: /Operador/ }));
      expect(within(panel).queryByLabelText('Contraseña inicial')).toBeNull();
      fireEvent.click(within(panel).getByRole('button', { name: 'Agregar' }));

      await waitFor(() =>
        expect(mockAddTeamMember).toHaveBeenCalledWith({
          name: 'María',
          email: 'maria@demo.mx',
          role_id: 2,
        }),
      );
      expect(await within(panel).findByTestId('temporary-password')).toHaveTextContent('kemo-7pdx');
      const whatsapp = within(panel).getByRole('link', { name: /WhatsApp/ });
      expect(decodeURIComponent(whatsapp.getAttribute('href') ?? '')).toContain(
        'Contraseña temporal: kemo-7pdx',
      );
      expect(decodeURIComponent(whatsapp.getAttribute('href') ?? '')).toContain('ClimaTotal Demo');
    });

    it('hides Agregar persona and row actions for readers', async () => {
      mockGetTeam.mockResolvedValue({ success: true, data: teamData({ canWrite: false }) });
      render(<TeamList />);
      await screen.findByTestId('team-desktop');

      expect(screen.queryByRole('button', { name: 'Agregar persona' })).toBeNull();
      expect(screen.queryByRole('button', { name: /Acciones de/ })).toBeNull();
    });
  });
});
