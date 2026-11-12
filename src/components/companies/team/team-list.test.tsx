import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamList } from '@/components/companies/team/team-list';
import { addTeamMember, getTeam } from '@/actions/team';
import type { TeamData } from '@/actions/team';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsDesktop } from '@/hooks/use-desktop';

jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: jest.fn(() => true) }));
jest.mock('@/hooks/use-desktop', () => {
  const useIsDesktop = jest.fn(() => false);
  // DesktopSwitch follows the same mocked width (ZIG-28).
  return {
    ...jest.requireActual('@/hooks/use-desktop'),
    useIsDesktop,
    useDesktopViewport: () => useIsDesktop(),
  };
});

const mockSearchParams = { current: new URLSearchParams() };
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), replace: mockReplace, push: jest.fn() }),
  usePathname: () => '/company/equipo',
  useSearchParams: () => mockSearchParams.current,
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
const mockUseIsDesktop = useIsDesktop as jest.MockedFunction<typeof useIsDesktop>;

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
    mockUseIsDesktop.mockReturnValue(false);
  });

  it('shows access states on phone cards; Todos adds deactivated people without actions', async () => {
    mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
    render(<TeamList />);
    await screen.findAllByText('Ana Admin');

    expect(screen.queryByText('Sin verificar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sin verificar' })).toBeNull();
    const access = screen.getAllByTestId('team-member-access').map((el) => el.textContent);
    expect(access).toEqual(['Activo', 'Debe cambiar contraseña']);
    expect(screen.queryByText('Beto Baja')).toBeNull();

    // The chosen pill is the filter tint, never the solid page-action blue (eb0ff213).
    const activos = screen.getByRole('button', { name: 'Activos' });
    expect(activos).toHaveAttribute('aria-pressed', 'true');
    expect(activos.className).toContain('bg-primary/10');
    expect(activos.className).not.toContain('bg-primary ');

    fireEvent.click(screen.getByRole('button', { name: /^Todos/ }));
    expect(screen.getByRole('button', { name: /^Todos/ }).className).toContain('bg-primary/10');
    expect(screen.getByRole('button', { name: 'Activos' }).className).not.toContain('bg-primary/10');

    const card = (await screen.findByText('Beto Baja')).closest('li')!;
    expect(within(card).getByTestId('team-member-access')).toHaveTextContent('Desactivado');
    expect(within(card).queryByRole('button', { name: /Acciones de/ })).toBeNull();
  });

  it('hides write actions for read-only viewers', async () => {
    mockGetTeam.mockResolvedValue({
      success: true,
      data: teamData({ canWrite: false }),
    });
    render(<TeamList />);
    await screen.findAllByText('Ana Admin');

    expect(screen.queryByRole('button', { name: /Agregar persona/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Acciones de/ })).toBeNull();
  });

  it('adds a person with the chosen role and shows the temporary password once', async () => {
    mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
    mockAddTeamMember.mockResolvedValue({
      success: true,
      data: { temporaryPassword: 'kemo-7pdx' },
    });
    render(<TeamList />);
    await screen.findAllByText('Ana Admin');

    fireEvent.click(screen.getAllByRole('button', { name: /Agregar persona/ })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre'), {
      target: { value: 'Lucía' },
    });
    fireEvent.change(within(dialog).getByLabelText('Correo electrónico'), {
      target: { value: 'lucia@demo.mx' },
    });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Operador/ }));
    expect(within(dialog).queryByLabelText('Contraseña inicial')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agregar' }));

    await waitFor(() => {
      expect(mockAddTeamMember).toHaveBeenCalledWith({
        name: 'Lucía',
        email: 'lucia@demo.mx',
        role_id: 2,
      });
    });
    expect(await within(dialog).findByTestId('temporary-password')).toHaveTextContent('kemo-7pdx');
    expect(within(dialog).getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
  });

  it('requires a role before adding', async () => {
    mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
    render(<TeamList />);
    await screen.findAllByText('Ana Admin');

    fireEvent.click(screen.getAllByRole('button', { name: /Agregar persona/ })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre'), {
      target: { value: 'Lucía' },
    });
    fireEvent.change(within(dialog).getByLabelText('Correo electrónico'), {
      target: { value: 'lucia@demo.mx' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agregar' }));

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
      mockUseIsDesktop.mockReturnValue(true);
    });

    it('shows Persona · Rol · Acceso · Alta with real access states and no «Sin verificar»', async () => {
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      render(<TeamList />);
      const desktop = await screen.findByTestId('team-desktop');

      const headers = within(desktop).getAllByRole('columnheader').map((h) => h.textContent);
      expect(headers.join(' ')).toMatch(/Persona.*Rol.*Acceso.*Alta/);
      expect(headers.join(' ')).not.toMatch(/Empresa|ID/);
      expect(within(desktop).getByText('1 Admin · 1 Operador', { exact: false })).toBeInTheDocument();
      // Each row renders the pill twice (column and narrow-width copy); CSS shows one.
      const access = within(desktop)
        .getAllByTestId('team-member-row')
        .map((row) => within(row).getAllByTestId('team-member-access')[0].textContent);
      expect(access).toEqual(['Activo', 'Debe cambiar contraseña']);
      expect(within(desktop).queryByText('Sin verificar')).toBeNull();
      expect(within(desktop).getAllByText('Operador').length).toBeGreaterThan(0);
    });

    it('Activos hides deactivated members and Todos shows them with Desactivado', async () => {
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      render(<TeamList />);
      const desktop = await screen.findByTestId('team-desktop');
      expect(within(desktop).queryByText('Beto Baja')).toBeNull();

      // Radix Select in jsdom: open with the keyboard, then pick the option.
      Element.prototype.hasPointerCapture = jest.fn(() => false);
      Element.prototype.scrollIntoView = jest.fn();
      const accessFilter = within(desktop).getByRole('combobox', { name: 'Filtrar por acceso' });
      expect(accessFilter).toHaveTextContent('Activos');
      fireEvent.keyDown(accessFilter, { key: 'ArrowDown' });
      fireEvent.click(await screen.findByRole('option', { name: 'Todos' }));

      const row = within(desktop).getByText('Beto Baja').closest('tr')!;
      expect(within(row).getAllByTestId('team-member-access')[0]).toHaveTextContent('Desactivado');
      expect(within(row).queryByRole('button', { name: /Acciones de/ })).toBeNull();
    });

    it('keeps every row action in the ⋯, nothing on hover; your own row only enables Editar', async () => {
      const user = userEvent.setup();
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      render(<TeamList />);
      const desktop = await screen.findByTestId('team-desktop');

      expect(within(desktop).queryByRole('button', { name: /^Cambiar rol de / })).toBeNull();
      expect(within(desktop).queryByRole('button', { name: /^Restablecer contraseña de / })).toBeNull();

      await user.click(within(desktop).getByRole('button', { name: 'Acciones de Carlos Técnico' }));
      const items = (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
      expect(items).toEqual(['Editar', 'Cambiar rol', 'Restablecer contraseña', 'Desactivar']);
      await user.keyboard('{Escape}');

      // Your own row: no role change, reset or deactivation (ZIG-I32 review, guards unchanged),
      // shown disabled like the phone menu.
      await user.click(within(desktop).getByRole('button', { name: 'Acciones de Ana Admin' }));
      await waitFor(() =>
        expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
          'Editar',
          'Cambiar rol',
          'Restablecer contraseña',
          'Desactivar (eres tú)',
        ]),
      );
      expect(screen.getByRole('menuitem', { name: 'Editar' })).not.toHaveAttribute('data-disabled');
      expect(screen.getByRole('menuitem', { name: 'Desactivar (eres tú)' })).toHaveAttribute(
        'data-disabled',
      );
    });

    it('opens Cambiar rol from the ⋯ and the edit panel from the row', async () => {
      const user = userEvent.setup();
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      render(<TeamList />);
      const desktop = await screen.findByTestId('team-desktop');

      await user.click(within(desktop).getByRole('button', { name: 'Acciones de Carlos Técnico' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Cambiar rol' }));
      expect(await screen.findByRole('dialog')).toHaveTextContent('Carlos Técnico');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      await user.click(within(desktop).getByText('carlos@demo.mx'));
      const panel = await screen.findByTestId('team-member-panel');
      expect(within(panel).getByLabelText('Nombre')).toHaveValue('Carlos Técnico');
    });

    it('sorts by the Alta header and counts «N de M personas» in the footer', async () => {
      const user = userEvent.setup();
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      render(<TeamList />);
      const desktop = await screen.findByTestId('team-desktop');

      const names = () =>
        within(desktop)
          .getAllByTestId('team-member-row')
          .map((row) => row.querySelector('.font-medium')?.firstChild?.textContent);
      expect(names()).toEqual(['Ana Admin', 'Carlos Técnico']);
      const alta = within(desktop).getByRole('columnheader', { name: /Alta/ });
      expect(alta).toHaveAttribute('aria-sort', 'none');

      // Dates sort newest first on the first click, then oldest first.
      await user.click(within(alta).getByRole('button'));
      expect(alta).toHaveAttribute('aria-sort', 'descending');
      expect(names()).toEqual(['Carlos Técnico', 'Ana Admin']);
      await user.click(within(alta).getByRole('button'));
      expect(alta).toHaveAttribute('aria-sort', 'ascending');
      expect(names()).toEqual(['Ana Admin', 'Carlos Técnico']);

      // Activos: 2 of the 3 people (one deactivated); no pager under 25.
      expect(within(desktop).getByTestId('list-footer')).toHaveTextContent('2 de 3 personas');
      expect(within(desktop).queryByRole('navigation', { name: 'Paginación' })).toBeNull();
      expect(within(desktop).getByRole('heading', { level: 2 })).toHaveTextContent('Equipo · 3');
    });

    it('shows the role and access as status pills', async () => {
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      render(<TeamList />);
      const desktop = await screen.findByTestId('team-desktop');

      const row = within(desktop).getAllByTestId('team-member-row')[1];
      const pills = [...row.querySelectorAll('[data-tone]')].map(
        (pill) => `${pill.textContent}:${pill.getAttribute('data-tone')}`,
      );
      expect(pills).toEqual(
        expect.arrayContaining(['Operador:violet', 'Debe cambiar contraseña:amber']),
      );
      const self = within(desktop).getAllByTestId('team-member-row')[0];
      expect(self.querySelector('[data-tone="blue"]')).toHaveTextContent('Admin');
      expect(self.querySelector('[data-tone="emerald"]')).toHaveTextContent('Activo');
    });

    it('Limpiar filtros appears with a filter and puts Activos and every role back', async () => {
      mockSearchParams.current = new URLSearchParams('rol=2');
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      render(<TeamList />);
      const desktop = await screen.findByTestId('team-desktop');

      expect(within(desktop).queryByText('Ana Admin')).toBeNull();
      fireEvent.click(within(desktop).getByRole('button', { name: 'Limpiar filtros' }));
      expect(await within(desktop).findByText('Ana Admin')).toBeInTheDocument();
      expect(within(desktop).getByRole('combobox', { name: 'Filtrar por rol' })).toHaveTextContent(
        'Todos los roles',
      );
      expect(mockReplace).toHaveBeenCalledWith('/company/equipo', { scroll: false });
      expect(within(desktop).queryByRole('button', { name: 'Limpiar filtros' })).toBeNull();
      mockSearchParams.current = new URLSearchParams();
    });

    it('adds a person from the panel and shows the temporary password once', async () => {
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      mockAddTeamMember.mockResolvedValue({
        success: true,
        data: { temporaryPassword: 'kemo-7pdx' },
      });
      render(<TeamList />);
      const desktop = await screen.findByTestId('team-desktop');

      fireEvent.click(within(desktop).getByRole('button', { name: 'Agregar persona' }));
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

    it('opens filtered by ?rol from Roles › Ver en Equipo', async () => {
      mockSearchParams.current = new URLSearchParams('rol=2');
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      render(<TeamList />);
      const desktop = await screen.findByTestId('team-desktop');

      expect(within(desktop).getByRole('combobox', { name: 'Filtrar por rol' })).toHaveTextContent('Operador');
      expect(within(desktop).queryByText('Ana Admin')).toBeNull();
      expect(within(desktop).getByText('Carlos Técnico')).toBeInTheDocument();
      mockSearchParams.current = new URLSearchParams();
    });

    it('writes the chosen role to ?rol', async () => {
      mockGetTeam.mockResolvedValue({ success: true, data: teamData() });
      render(<TeamList />);
      const desktop = await screen.findByTestId('team-desktop');

      Element.prototype.hasPointerCapture = jest.fn(() => false);
      Element.prototype.scrollIntoView = jest.fn();
      const roleFilter = within(desktop).getByRole('combobox', { name: 'Filtrar por rol' });
      fireEvent.keyDown(roleFilter, { key: 'ArrowDown' });
      fireEvent.click(await screen.findByRole('option', { name: 'Operador' }));

      expect(mockReplace).toHaveBeenCalledWith('/company/equipo?rol=2', { scroll: false });
      expect(within(desktop).queryByText('Ana Admin')).toBeNull();
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
