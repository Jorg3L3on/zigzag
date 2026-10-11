/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';

import { DashboardQuickActions } from '@/components/dashboard/dashboard-quick-actions';

let mockGranted: string[] = [];

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    can: (permission?: string) => !permission || mockGranted.includes(permission),
    loading: false,
    isSystem: false,
  }),
}));

describe('DashboardQuickActions', () => {
  beforeEach(() => {
    mockGranted = [
      'tickets.read',
      'tickets.write',
      'clients.write',
      'services.write',
    ];
  });

  it('renders a chip row without the old card heading', () => {
    render(<DashboardQuickActions persona="admin" />);

    const nav = screen.getByRole('navigation', { name: 'Acciones rápidas' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Crear ticket',
      'Crear presupuesto',
      'Crear cliente',
      'Crear servicio',
      'Ver tickets',
      'Recordatorios',
    ]);
    expect(
      screen.queryByRole('heading', { name: 'Acciones rápidas' }),
    ).not.toBeInTheDocument();
  });

  it('keeps 44px touch targets on every chip', () => {
    render(<DashboardQuickActions persona="operator" />);

    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toContain('min-h-11');
    }
  });

  it('orders by persona priority', () => {
    render(<DashboardQuickActions persona="operator" />);

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Crear ticket',
      'Crear presupuesto',
      'Ver tickets',
      'Recordatorios',
      'Crear cliente',
      'Crear servicio',
    ]);
  });

  it('links Crear presupuesto to the composer and hides it without tickets.write', () => {
    const { unmount } = render(<DashboardQuickActions persona="admin" />);
    expect(
      screen.getByRole('link', { name: 'Crear presupuesto' }),
    ).toHaveAttribute('href', '/presupuestos/create');
    unmount();

    mockGranted = ['tickets.read'];
    render(<DashboardQuickActions persona="viewer" />);
    expect(
      screen.queryByRole('link', { name: 'Crear presupuesto' }),
    ).not.toBeInTheDocument();
  });

  it('renders nothing without permitted actions', () => {
    mockGranted = [];
    const { container } = render(<DashboardQuickActions persona="admin" />);

    expect(container).toBeEmptyDOMElement();
  });
});
