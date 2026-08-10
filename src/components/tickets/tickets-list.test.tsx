import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TicketsList from '@/components/tickets/tickets-list';
import { getTicketsList } from '@/actions/tickets';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import {
  readOfflineSnapshot,
  writeOfflineSnapshot,
} from '@/lib/offline-snapshot';

jest.mock('@/actions/tickets', () => ({
  getTicketsList: jest.fn(),
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

const mockGetTicketsList = getTicketsList as jest.MockedFunction<
  typeof getTicketsList
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

const makeTicket = (overrides = {}) => ({
  id: BigInt(10),
  client_id: 1,
  client_name: 'Cliente Alfa',
  client_tel: '5551234567',
  email: 'alfa@example.com',
  document: null,
  ticket_date: new Date('2026-05-01T12:00:00Z'),
  total: 100,
  paid: 0,
  finished: false,
  created_at: new Date('2026-05-01T00:00:00Z'),
  updated_at: null,
  deleted_at: null,
  company_id: 1,
  ...overrides,
});

const arrange = ({
  canWrite = true,
  result = { success: true, data: [] },
}: {
  canWrite?: boolean;
  result?: Awaited<ReturnType<typeof getTicketsList>>;
} = {}) => {
  mockUseCompany.mockReturnValue({
    selectedCompany,
    setSelectedCompany: jest.fn(),
  });
  mockUsePermissions.mockReturnValue({
    isSystem: false,
    permissions: canWrite ? ['tickets.read', 'tickets.write'] : ['tickets.read'],
    loading: false,
    can: (permission?: string) =>
      !permission ||
      (canWrite
        ? ['tickets.read', 'tickets.write'].includes(permission)
        : permission === 'tickets.read'),
  });
  mockGetTicketsList.mockResolvedValue(result);
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

describe('TicketsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadOfflineSnapshot.mockResolvedValue(null);
    mockWriteOfflineSnapshot.mockResolvedValue({} as never);
  });

  it('shows empty state after loading tickets', async () => {
    arrange();

    render(<TicketsList />);

    expect(
      await screen.findByText('Sin tickets'),
    ).toBeInTheDocument();
  });

  it('renders ticket rows when data is available', async () => {
    arrange({
      result: {
        success: true,
        data: [makeTicket()],
      },
    });

    render(<TicketsList />);

    await waitFor(() => {
      expect(screen.getAllByText('Cliente Alfa').length).toBeGreaterThan(0);
    });
    expect(screen.getByLabelText(/buscar tickets/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(mockWriteOfflineSnapshot).toHaveBeenCalledWith(
        'tickets',
        selectedCompany.id,
        expect.arrayContaining([expect.objectContaining({ client_name: 'Cliente Alfa' })]),
      );
    });
  });

  it('refreshes tickets from a mobile pull gesture', async () => {
    mockMobileViewport();
    arrange({
      result: {
        success: true,
        data: [makeTicket()],
      },
    });

    render(<TicketsList />);

    await waitFor(() => {
      expect(mockGetTicketsList).toHaveBeenCalledTimes(1);
    });

    const pullArea = screen.getByTestId('tickets-pull-to-refresh');
    fireEvent.touchStart(pullArea, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(pullArea, { touches: [{ clientY: 160 }] });
    fireEvent.touchEnd(pullArea);

    await waitFor(() => {
      expect(mockGetTicketsList).toHaveBeenCalledTimes(2);
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
      key: 'tickets:v1:company:1',
      resource: 'tickets',
      companyKey: 'company:1',
      schemaVersion: 1,
      updatedAt: snapshotUpdatedAt,
      data: [makeTicket({ client_name: 'Cliente Snapshot' })],
    });

    render(<TicketsList />);

    expect(await screen.findByRole('status')).toHaveTextContent(
      `Sin conexión — datos de ${snapshotUpdatedAt}`,
    );
    expect(screen.getAllByText('Cliente Snapshot').length).toBeGreaterThan(0);
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
  });
});
