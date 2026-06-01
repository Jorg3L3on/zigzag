import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientList } from '@/components/clients/client-list';
import { getClientsList } from '@/actions/clients';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';

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

const mockGetClientsList = getClientsList as jest.MockedFunction<
  typeof getClientsList
>;
const mockUseCompany = useCompany as jest.MockedFunction<typeof useCompany>;
const mockUsePermissions = usePermissions as jest.MockedFunction<
  typeof usePermissions
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
  result = { success: true, data: [] },
}: {
  canWrite?: boolean;
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
      (canWrite
        ? ['clients.read', 'clients.write'].includes(permission)
        : permission === 'clients.read'),
  });
  mockGetClientsList.mockResolvedValue(result);
};

describe('ClientList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      screen.getAllByRole('button', { name: /Limpiar filtros de clientes/i }),
    ).toHaveLength(2);
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
});
