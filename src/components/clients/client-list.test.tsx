import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientList } from '@/components/clients/client-list';
import { getClientsList } from '@/actions/clients';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import {
  readOfflineSnapshot,
  writeOfflineSnapshot,
} from '@/lib/offline-snapshot';

jest.mock('@/actions/clients', () => ({
  deleteClient: jest.fn(),
  getClientsList: jest.fn(),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: jest.fn(),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: jest.fn(),
}));

jest.mock('@/lib/offline-snapshot', () => ({
  formatOfflineSnapshotBanner: jest.fn(
    (updatedAt: string) => `Sin conexión — datos de ${updatedAt}`,
  ),
  readOfflineSnapshot: jest.fn(),
  writeOfflineSnapshot: jest.fn(),
}));

const mockGetClientsList = getClientsList as jest.MockedFunction<
  typeof getClientsList
>;
const mockUseCompany = useCompany as jest.MockedFunction<typeof useCompany>;
const mockUsePermissions = usePermissions as jest.MockedFunction<
  typeof usePermissions
>;
const mockReadOfflineSnapshot = readOfflineSnapshot as jest.MockedFunction<
  typeof readOfflineSnapshot
>;
const mockWriteOfflineSnapshot = writeOfflineSnapshot as jest.MockedFunction<
  typeof writeOfflineSnapshot
>;

const selectedCompany = {
  id: 1,
  name: 'Acme',
  logo: () => null,
  logoUrl: null,
  plan: 'basic',
  is_system: false,
};

const makeClient = (overrides = {}) =>
  ({
    id: 10,
    name: 'Cliente Alfa',
    phone: '5551234567',
    email: 'alfa@example.com',
    document: null,
    address: null,
    street: 'Calle Uno',
    exterior_number: '12',
    interior_number: null,
    neighborhood: 'Centro',
    city: 'CDMX',
    state: 'CDMX',
    postal_code: '01000',
    country: 'México',
    company_id: 1,
    created_at: new Date('2026-05-01T00:00:00Z'),
    updated_at: new Date('2026-05-01T00:00:00Z'),
    deleted_at: null,
    ...overrides,
  }) as Awaited<ReturnType<typeof getClientsList>> extends {
    data?: Array<infer T>;
  }
    ? T
    : never;

const arrange = ({
  canWrite = true,
  canAnotar = false,
  result = { success: true, data: [] },
}: {
  canWrite?: boolean;
  canAnotar?: boolean;
  result?: Awaited<ReturnType<typeof getClientsList>>;
} = {}) => {
  mockUseCompany.mockReturnValue({
    selectedCompany,
    setSelectedCompany: jest.fn(),
  });
  mockUsePermissions.mockReturnValue({
    isSystem: false,
    permissions: canWrite ? ['clients.read', 'clients.write'] : ['clients.read'],
    loading: false,
    can: (permission?: string) =>
      !permission ||
      (canAnotar && permission === 'tickets.write') ||
      (canWrite
        ? ['clients.read', 'clients.write'].includes(permission)
        : permission === 'clients.read'),
  });
  mockGetClientsList.mockResolvedValue(result);
};

const mockMobileViewport = () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: 0,
  });
};

/** From lg (ZIG-I33): DesktopSwitch mounts only the desktop tree. */
const mockDesktopViewport = () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width: 1024px'),
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

const manyClients = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    makeClient({ id: index + 1, name: `Cliente ${String(index + 1).padStart(2, '0')}` }),
  );

describe('ClientList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadOfflineSnapshot.mockResolvedValue(null);
    mockWriteOfflineSnapshot.mockResolvedValue({} as never);
  });

  it('cards offer Anotar trabajo, no Llamar, and delete only from the menu with a named confirm (ZIG-I18-14, ZIG-27)', async () => {
    const user = userEvent.setup();
    arrange({ canAnotar: true, result: { success: true, data: [makeClient({ name: 'Sra. López' })] } });

    render(<ClientList />);

    await screen.findAllByText('Sra. López');
    expect(screen.queryByRole('link', { name: 'Llamar' })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Anotar trabajo' })).toHaveAttribute(
      'href',
      '/anotar?clientId=10',
    );
    const menu = screen.getByRole('button', { name: 'Más acciones de Sra. López' });
    await user.click(menu);
    await user.click(await screen.findByRole('menuitem', { name: 'Eliminar cliente' }));
    expect(await screen.findByText('¿Borrar a Sra. López?')).toBeInTheDocument();
    expect(screen.queryByText('¿Estás seguro?')).not.toBeInTheDocument();
  });

  it('hides Anotar trabajo without permission (ZIG-I18-14)', async () => {
    arrange({ result: { success: true, data: [makeClient({ phone: null })] } });

    render(<ClientList />);

    await screen.findAllByText('Cliente Alfa');
    expect(screen.queryByRole('link', { name: 'Llamar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Anotar trabajo' })).not.toBeInTheDocument();
  });

  it('shows a permission-aware first-use empty state for writers', async () => {
    arrange();

    render(<ClientList />);

    expect(
      screen.getByRole('status', { name: /cargando lista de clientes/i }),
    ).toBeInTheDocument();

    expect(await screen.findByText('Sin clientes')).toBeInTheDocument();
    expect(
      screen.getByText(/Agrega el primer cliente/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Nuevo cliente/i }),
    ).toBeInTheDocument();
  });

  it('does not offer write actions in the empty state for read-only users', async () => {
    arrange({ canWrite: false });

    render(<ClientList />);

    expect(await screen.findByText('Sin clientes')).toBeInTheDocument();
    expect(
      screen.getByText(/No hay clientes registrados/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Nuevo cliente/i }),
    ).not.toBeInTheDocument();
  });

  it('distinguishes filtered empty results and offers to clear filters', async () => {
    const user = userEvent.setup();
    arrange({ result: { success: true, data: [makeClient()] } });

    render(<ClientList />);

    expect(await screen.findAllByText('Cliente Alfa')).not.toHaveLength(0);

    await user.type(
      screen.getByRole('textbox', { name: /buscar clientes/i }),
      'inexistente',
    );

    expect(
      await screen.findByText(/No hay clientes que coincidan/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Búsqueda: inexistente')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /Limpiar filtros de clientes/i }).length,
    ).toBeGreaterThanOrEqual(1);
    await waitFor(() => {
      expect(mockWriteOfflineSnapshot).toHaveBeenCalledWith(
        'clients',
        selectedCompany.id,
        expect.arrayContaining([expect.objectContaining({ name: 'Cliente Alfa' })]),
      );
    });
  });

  it('opens mobile filter sheet with correo, teléfono, and sort controls', async () => {
    const user = userEvent.setup();
    arrange({ result: { success: true, data: [makeClient()] } });

    render(<ClientList />);

    expect(await screen.findAllByText('Cliente Alfa')).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Abrir filtros' }));

    expect(await screen.findByRole('heading', { name: 'Filtros' })).toBeInTheDocument();
    expect(screen.getByText('Correo, teléfono y orden de la lista.')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', {
        name: /Filtrar clientes por correo: Con correo/i,
      }).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByRole('button', {
        name: /Filtrar clientes por teléfono: Con teléfono/i,
      }).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole('combobox', { name: /Ordenar lista de clientes/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getAllByRole('button', {
        name: /Filtrar clientes por correo: Sin correo/i,
      })[0],
    );
    await user.click(screen.getByRole('button', { name: 'Listo' }));

    expect(
      await screen.findByRole('button', { name: /Abrir filtros \(1 activos\)/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Sin correo').length).toBeGreaterThanOrEqual(1);
  });

  it('shows load errors as recoverable alert states', async () => {
    arrange({
      result: {
        success: false,
        error: 'No se pudieron cargar los clientes',
        errorType: 'server',
      },
    });

    render(<ClientList />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocurrió un error del servidor',
    );

    await userEvent.click(screen.getByRole('button', { name: /Reintentar/i }));

    await waitFor(() => {
      expect(mockGetClientsList).toHaveBeenCalledTimes(2);
    });
  });

  it('refreshes clients from a mobile pull gesture', async () => {
    mockMobileViewport();
    arrange({ result: { success: true, data: [makeClient()] } });

    render(<ClientList />);

    await waitFor(() => {
      expect(mockGetClientsList).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findAllByText('Cliente Alfa')).not.toHaveLength(0);

    const pullArea = screen.getByTestId('clients-pull-to-refresh');
    fireEvent.touchStart(pullArea, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(pullArea, { touches: [{ clientY: 160 }] });
    fireEvent.touchEnd(pullArea);

    await waitFor(() => {
      expect(mockGetClientsList).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a read-only offline snapshot on network load failure', async () => {
    const snapshotUpdatedAt = '2026-08-10T05:00:00.000Z';
    arrange({
      result: {
        success: false,
        error: 'No hay red',
        errorType: 'network',
      },
    });
    mockReadOfflineSnapshot.mockResolvedValue({
      key: 'clients:v2:company:1',
      resource: 'clients',
      companyKey: 'company:1',
      schemaVersion: 2,
      updatedAt: snapshotUpdatedAt,
      data: [makeClient({ name: 'Cliente Snapshot' })],
    });

    render(<ClientList />);

    expect(
      await screen.findByText(`Sin conexión — datos de ${snapshotUpdatedAt}`),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Cliente Snapshot').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /Editar Cliente Snapshot/i }),
    ).not.toBeInTheDocument();
  });

  it('pages the phone cards by 12 and shows no table (ZIG-I33)', async () => {
    mockMobileViewport();
    arrange({ result: { success: true, data: manyClients(30) } });

    render(<ClientList />);

    expect(await screen.findByText('Cliente 01')).toBeInTheDocument();
    expect(screen.getByText('Cliente 12')).toBeInTheDocument();
    expect(screen.queryByText('Cliente 13')).not.toBeInTheDocument();
    expect(screen.getByText(/Página 1 de\s+3/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  describe('from lg (ZIG-I33)', () => {
    beforeEach(() => {
      mockDesktopViewport();
    });

    it('draws only the table, 25 a page with the shared footer and pager', async () => {
      const user = userEvent.setup();
      arrange({ result: { success: true, data: manyClients(30) } });

      render(<ClientList />);

      const table = await screen.findByRole('table', { name: 'Clientes' });
      expect(screen.queryByTestId('clients-pull-to-refresh')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Más acciones de/ })).not.toBeInTheDocument();
      expect(screen.getAllByTestId('clients-row')).toHaveLength(25);
      expect(screen.getByTestId('list-footer')).toHaveTextContent('1–25 de 30 clientes');
      expect(table.querySelector('thead')).toHaveClass('sticky', 'top-16');

      await user.click(screen.getByRole('button', { name: 'Página 2' }));

      expect(screen.getAllByTestId('clients-row')).toHaveLength(5);
      expect(screen.getByTestId('list-footer')).toHaveTextContent('26–30 de 30 clientes');
      expect(screen.getByText('Cliente 30')).toBeInTheDocument();
    });

    it('sorts by header click with aria-sort on the th', async () => {
      const user = userEvent.setup();
      arrange({ result: { success: true, data: manyClients(3) } });

      render(<ClientList />);

      await screen.findByRole('table', { name: 'Clientes' });
      const nameHeader = screen.getByRole('columnheader', { name: /Nombre/ });
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
      expect(screen.getByRole('button', { name: /Nombre/ })).not.toHaveAttribute('aria-sort');
      expect(screen.getByTestId('list-footer')).toHaveTextContent('3 de 3 clientes');
      expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Nombre/ }));

      expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
      expect(screen.getAllByTestId('clients-row')[0]).toHaveTextContent('Cliente 03');
    });

    it('shows the shared empty and no-results states', async () => {
      const user = userEvent.setup();
      arrange({ result: { success: true, data: [makeClient()] } });

      render(<ClientList />);

      await screen.findByRole('table', { name: 'Clientes' });
      await user.type(screen.getByRole('textbox', { name: /buscar clientes/i }), 'inexistente');

      expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /^Limpiar filtros$/ }));
      expect(await screen.findByRole('table', { name: 'Clientes' })).toBeInTheDocument();
    });
  });
});
