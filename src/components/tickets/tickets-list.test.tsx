import { render, screen, waitFor } from '@testing-library/react';
import TicketsList from '@/components/tickets/tickets-list';
import { getTicketsList } from '@/actions/tickets';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';

jest.mock('@/actions/tickets', () => ({
  getTicketsList: jest.fn(),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: jest.fn(),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: jest.fn(),
}));

const mockGetTicketsList = getTicketsList as jest.MockedFunction<
  typeof getTicketsList
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

describe('TicketsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
  });
});
