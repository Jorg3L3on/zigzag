import { render, screen, waitFor } from '@testing-library/react';
import { OperatorCompanyMetrics } from '@/components/operator-console/operator-company-metrics';

const mockUseCompany = jest.fn();
const mockFetchDashboardMetrics = jest.fn();
const mockFetchOnboardingStatus = jest.fn();

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

jest.mock('@/actions/dashboard', () => ({
  fetchDashboardMetrics: (...args: unknown[]) =>
    mockFetchDashboardMetrics(...args),
}));

jest.mock('@/actions/onboarding-status', () => ({
  fetchOnboardingStatus: (...args: unknown[]) =>
    mockFetchOnboardingStatus(...args),
}));

describe('OperatorCompanyMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing for the system tenant', () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: { id: 1, name: 'Sistema', is_system: true },
    });

    const { container } = render(<OperatorCompanyMetrics />);
    expect(container).toBeEmptyDOMElement();
    expect(mockFetchDashboardMetrics).not.toHaveBeenCalled();
  });

  it('loads and shows business pulse cards for a selected tenant', async () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: { id: 42, name: 'Acme', is_system: false },
    });
    mockFetchDashboardMetrics.mockResolvedValue({
      success: true,
      data: {
        totalTickets: 12,
        totalClients: 4,
        totalCashCollected: 1500,
        kpis: [
          { key: 'activeTickets', value: 3 },
          { key: 'outstandingBalance', value: 250 },
        ],
      },
    });
    mockFetchOnboardingStatus.mockResolvedValue({
      success: true,
      data: { totalUsers: 5 },
    });

    render(<OperatorCompanyMetrics />);

    expect(await screen.findByText('Pulso del negocio')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockFetchDashboardMetrics).toHaveBeenCalledWith({ companyId: 42 });
    });
    expect(screen.getByText('Tickets')).toBeInTheDocument();
    expect(screen.getByText('Tickets activos')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Cobrado')).toBeInTheDocument();
    expect(screen.getByText('Por cobrar')).toBeInTheDocument();
  });
});
