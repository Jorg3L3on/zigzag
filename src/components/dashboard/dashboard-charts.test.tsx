import { render, screen } from '@testing-library/react';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
});

describe('DashboardCharts', () => {
  it('shows accessible empty state for revenue chart', () => {
    render(
      <DashboardCharts
        revenueByMonth={[
          { monthKey: '2026-01', label: 'ene 2026', revenue: 0 },
        ]}
        clientMetrics={[]}
        revenueMonthCount={12}
      />,
    );

    const empty = screen.getByTestId('dashboard-revenue-chart-empty');
    expect(empty).toHaveAttribute('role', 'status');
    expect(empty).toHaveTextContent(/No hay ingresos/i);
  });

  it('renders revenue chart with accessibility layer and data table', () => {
    const { container } = render(
      <DashboardCharts
        revenueByMonth={[
          { monthKey: '2026-01', label: 'ene 2026', revenue: 100 },
        ]}
        clientMetrics={[
          { id: 1, name: 'Cliente A', ticketCount: 2, totalSpent: 500 },
        ]}
        revenueMonthCount={3}
      />,
    );

    expect(
      screen.getByRole('img', {
        name: /Gráfica de ingresos por mes, últimos 3 meses/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /Gráfica de barras: clientes con mayor gasto/i,
      }),
    ).toHaveAttribute('aria-describedby', 'dashboard-client-metrics');

    expect(container.querySelector('[data-chart]')).toBeTruthy();

    expect(
      screen.getByRole('table', { name: /Ingresos por mes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: /Clientes con mayor gasto/i }),
    ).toBeInTheDocument();
  });

  it('shows accessible empty state for client spend chart', () => {
    render(
      <DashboardCharts
        revenueByMonth={[
          { monthKey: '2026-01', label: 'ene 2026', revenue: 100 },
        ]}
        clientMetrics={[]}
      />,
    );

    const empty = screen.getByTestId('dashboard-clients-chart-empty');
    expect(empty).toHaveAttribute('role', 'status');
    expect(empty).toHaveTextContent(/No hay clientes/i);
  });
});
