/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { OperatorConsoleDetail } from '@/components/operator-console/operator-console-detail';

const mockUseCompany = jest.fn();
const mockGetCompanyOperatorSummary = jest.fn();

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

jest.mock('@/actions/company-operator', () => ({
  getCompanyOperatorSummary: (...args: unknown[]) =>
    mockGetCompanyOperatorSummary(...args),
}));

jest.mock('@/actions/company-lifecycle', () => ({
  setCompanyLifecycleStatus: jest.fn(),
}));

jest.mock('@/components/operator-console/operator-company-overview', () => ({
  OperatorCompanyOverview: () => <div>Overview stub</div>,
}));

jest.mock('@/components/operator-console/operator-company-metrics', () => ({
  OperatorCompanyMetrics: () => <div>Metrics stub</div>,
}));

jest.mock('@/components/operator-console/operator-activity-panel', () => ({
  OperatorActivityPanel: () => <div>Activity stub</div>,
}));

jest.mock('@/components/operator-console/operator-access-panel', () => ({
  OperatorAccessPanel: () => <div>Access stub</div>,
}));

jest.mock('@/components/operator-console/operator-lifecycle-panel', () => ({
  OperatorLifecyclePanel: () => <div>Lifecycle stub</div>,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('OperatorConsoleDetail', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    }) as unknown as typeof fetch;

    mockGetCompanyOperatorSummary.mockResolvedValue({
      success: true,
      data: {
        companyId: 4,
        name: 'ClimaTotal Demo',
        email: 'demo@test.com',
        phone: '555',
        lifecycle: 'ACTIVE',
        lifecycleLabel: 'Activa',
        allowsAuthentication: true,
        readiness: {
          lifecycle: 'ACTIVE',
          profileReady: true,
          productionReady: true,
          missing: [],
          missingLabels: [],
        },
        roleCount: 2,
        editHref: '/companies/4/edit',
      },
    });
  });

  it('shows empty state without selection', () => {
    mockUseCompany.mockReturnValue({ selectedCompany: null });
    render(<OperatorConsoleDetail />);
    expect(screen.getByText('Sin empresa seleccionada')).toBeInTheDocument();
  });

  it('renders tabs and primary dashboard CTA for an active tenant', async () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: {
        id: 4,
        name: 'ClimaTotal Demo',
        is_system: false,
      },
    });

    render(<OperatorConsoleDetail />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Abrir dashboard' }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('tab', { name: 'Pulso' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Overview stub')).toBeInTheDocument();
    expect(screen.getByText('Metrics stub')).toBeInTheDocument();
    expect(screen.queryByText('Activity stub')).not.toBeInTheDocument();
  });
});
