/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

/** DesktopSwitch keeps one tree: the desktop one when the lg query matches. */
const mockViewport = (desktop: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: desktop && query.includes('min-width'),
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

describe('OperatorConsoleDetail', () => {
  beforeEach(() => {
    mockViewport(false);
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

    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Overview stub')).toBeInTheDocument();
    expect(screen.getByText('Metrics stub')).toBeInTheDocument();
    expect(screen.queryByText('Activity stub')).not.toBeInTheDocument();
  });

  it('uses the list view tabs from lg, without the solid blue pill', async () => {
    mockViewport(true);
    mockUseCompany.mockReturnValue({
      selectedCompany: { id: 4, name: 'ClimaTotal Demo', is_system: false },
    });

    render(<OperatorConsoleDetail />);

    const tabs = await screen.findByRole('navigation', {
      name: 'Secciones de la empresa seleccionada',
    });
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    const resumen = within(tabs).getByRole('button', { name: 'Resumen' });
    expect(resumen).toHaveAttribute('aria-pressed', 'true');
    expect(resumen.className).toMatch(/border-primary/);
    expect(screen.getByRole('region', { name: 'Resumen' })).toBeInTheDocument();

    fireEvent.click(within(tabs).getByRole('button', { name: 'Actividad' }));
    expect(within(tabs).getByRole('button', { name: 'Actividad' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Activity stub')).toBeInTheDocument();
  });
});
