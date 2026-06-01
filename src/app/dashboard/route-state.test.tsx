import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardError from '@/app/dashboard/error';
import DashboardLoading from '@/app/dashboard/loading';
import DashboardNotFound from '@/app/dashboard/not-found';

describe('dashboard route recovery states', () => {
  it('renders an accessible loading boundary', () => {
    render(<DashboardLoading />);

    expect(
      screen.getByRole('status', { name: /Cargando sección del dashboard/i }),
    ).toBeInTheDocument();
  });

  it('renders a safe error recovery screen with retry', async () => {
    const user = userEvent.setup();
    const reset = jest.fn();

    render(<DashboardError error={new Error('database exploded')} reset={reset} />);

    expect(screen.getAllByText('No se pudo cargar la sección')).not.toHaveLength(
      0,
    );
    expect(screen.queryByText(/database exploded/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Reintentar/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('renders a dashboard not-found recovery screen', () => {
    render(<DashboardNotFound />);

    expect(screen.getAllByText('No encontramos este recurso')).not.toHaveLength(
      0,
    );
    expect(
      screen.getByRole('link', { name: /Volver al dashboard/i }),
    ).toHaveAttribute('href', '/dashboard');
  });
});
