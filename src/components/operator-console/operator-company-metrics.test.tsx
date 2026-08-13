import { render, screen, waitFor } from '@testing-library/react';
import { OperatorCompanyMetrics } from '@/components/operator-console/operator-company-metrics';

const mockUseCompany = jest.fn();
const mockFetchDashboardMetrics = jest.fn();
const mockFetchOperatorUserSessions = jest.fn();

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

jest.mock('@/actions/dashboard', () => ({
  fetchDashboardMetrics: (...args: unknown[]) =>
    mockFetchDashboardMetrics(...args),
}));

jest.mock('@/actions/operator-user-sessions', () => ({
  fetchOperatorUserSessions: (...args: unknown[]) =>
    mockFetchOperatorUserSessions(...args),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
});

const sparkline = [
  { monthKey: '2026-01', label: 'ene 2026', value: 1 },
  { monthKey: '2026-02', label: 'feb 2026', value: 2 },
];

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

  it('loads resumen KPIs, charts, and user sessions for a selected tenant', async () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: { id: 42, name: 'Acme', is_system: false },
    });
    mockFetchDashboardMetrics.mockResolvedValue({
      success: true,
      data: {
        totalTickets: 12,
        totalClients: 4,
        totalCashCollected: 1500,
        revenueByMonth: [
          { monthKey: '2026-01', label: 'ene 2026', revenue: 100 },
        ],
        paymentStatusBreakdown: [
          { status: 'paid', label: 'Saldado', count: 1, amount: 100 },
          { status: 'partial', label: 'Pago parcial', count: 0, amount: 0 },
          { status: 'pending', label: 'Pendiente', count: 0, amount: 0 },
        ],
        kpis: [
          {
            key: 'revenue',
            label: 'Ingresos del periodo',
            value: 100,
            deltaPercent: 10,
            sparkline,
            format: 'currency',
          },
          {
            key: 'cashCollected',
            label: 'Efectivo cobrado',
            value: 80,
            deltaPercent: 5,
            sparkline,
            format: 'currency',
          },
          {
            key: 'outstandingBalance',
            label: 'Saldo por cobrar',
            value: 20,
            deltaPercent: -2,
            sparkline,
            format: 'currency',
          },
          {
            key: 'activeTickets',
            label: 'Tickets activos',
            value: 3,
            deltaPercent: 0,
            sparkline,
            format: 'number',
          },
        ],
      },
    });
    mockFetchOperatorUserSessions.mockResolvedValue({
      success: true,
      data: [
        {
          id: '10',
          name: 'Ana López',
          email: 'ana@acme.test',
          lastSignedInAt: new Date('2026-08-12T10:00:00.000Z'),
        },
      ],
    });

    render(<OperatorCompanyMetrics />);

    expect(await screen.findByText('Resumen')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockFetchDashboardMetrics).toHaveBeenCalledWith({ companyId: 42 });
      expect(mockFetchOperatorUserSessions).toHaveBeenCalledWith(42);
    });
    expect(screen.getByText('Ingresos del periodo')).toBeInTheDocument();
    expect(screen.getByText('Efectivo cobrado')).toBeInTheDocument();
    expect(screen.getByText('Saldo por cobrar')).toBeInTheDocument();
    expect(screen.getByText('Tickets activos')).toBeInTheDocument();
    expect(screen.getByText('Ana López')).toBeInTheDocument();
    expect(screen.getByText('ana@acme.test')).toBeInTheDocument();
  });
});
