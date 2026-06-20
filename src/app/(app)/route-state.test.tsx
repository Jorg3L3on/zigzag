import { render, screen } from '@testing-library/react';
import type React from 'react';
import userEvent from '@testing-library/user-event';
import DashboardError from '@/app/(app)/error';
import ForbiddenPage from '@/app/(app)/forbidden/page';
import DashboardLoading from '@/app/(app)/loading';
import DashboardNotFound from '@/app/(app)/not-found';

jest.mock('@/components/tripled', () => {
  const actual = jest.requireActual('@/components/tripled');
  return {
    ...actual,
    TripledDashboardShell: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    TripledMobileAppBar: ({ title }: { title: string }) => <div>{title}</div>,
    TripledPageHeader: ({ items }: { items: Array<{ label: string }> }) => (
      <div>{items.map((item) => item.label).join(' / ')}</div>
    ),
    TripledResourceCard: ({
      title,
      description,
      children,
    }: {
      title: string;
      description?: string;
      children: React.ReactNode;
    }) => (
      <section>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {children}
      </section>
    ),
  };
});

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

  it('renders permission-denied recovery actions without exposing internals', () => {
    render(<ForbiddenPage />);

    expect(screen.getAllByText('No tienes acceso')).not.toHaveLength(0);
    expect(screen.getByText(/permisos asignados a tu rol/i)).toBeInTheDocument();
    expect(screen.getByText(/selecciona una empresa/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Ir al dashboard/i }),
    ).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /Ver mi cuenta/i })).toHaveAttribute(
      'href',
      '/account',
    );
  });
});
