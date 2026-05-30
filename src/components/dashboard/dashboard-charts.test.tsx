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

const paymentBreakdown = [
  { status: 'paid' as const, label: 'Saldado', count: 2, amount: 0 },
  { status: 'partial' as const, label: 'Pago parcial', count: 1, amount: 50 },
  { status: 'pending' as const, label: 'Pendiente', count: 1, amount: 100 },
];

describe('DashboardCharts', () => {
  it('shows accessible empty state for revenue chart', () => {
    render(
      <DashboardCharts
        revenueByMonth={[
          { monthKey: '2026-01', label: 'ene 2026', revenue: 0 },
        ]}
        paymentStatusBreakdown={paymentBreakdown}
        revenueMonthCount={12}
      />,
    );

    const empty = screen.getByTestId('dashboard-revenue-chart-empty');
    expect(empty).toHaveAttribute('role', 'status');
    expect(empty).toHaveTextContent(/No hay ingresos/i);
  });

  it('renders revenue bar chart and payment status section', () => {
    const { container } = render(
      <DashboardCharts
        revenueByMonth={[
          { monthKey: '2026-01', label: 'ene 2026', revenue: 100 },
        ]}
        paymentStatusBreakdown={paymentBreakdown}
        revenueMonthCount={3}
      />,
    );

    expect(
      screen.getByRole('img', {
        name: /Gráfica de barras de ingresos por mes, últimos 3 meses/i,
      }),
    ).toBeInTheDocument();
    expect(
      document.getElementById('dashboard-payment-status-title'),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Saldado/i).length).toBeGreaterThan(0);

    expect(container.querySelector('[data-chart]')).toBeTruthy();

    expect(
      screen.getByRole('table', { name: /Ingresos por mes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: /Estado de cobro de tickets/i }),
    ).toBeInTheDocument();
  });

  it('shows accessible empty state for payment status when no tickets', () => {
    render(
      <DashboardCharts
        revenueByMonth={[
          { monthKey: '2026-01', label: 'ene 2026', revenue: 100 },
        ]}
        paymentStatusBreakdown={[
          { status: 'paid', label: 'Saldado', count: 0, amount: 0 },
          { status: 'partial', label: 'Pago parcial', count: 0, amount: 0 },
          { status: 'pending', label: 'Pendiente', count: 0, amount: 0 },
        ]}
      />,
    );

    const empty = screen.getByTestId('dashboard-payment-status-empty');
    expect(empty).toHaveAttribute('role', 'status');
    expect(empty).toHaveTextContent(/No hay tickets/i);
  });
});
