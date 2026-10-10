/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MobileBottomDock } from '@/components/mobile-bottom-dock';

let mockPathname = '/dashboard';
let mockGranted = ['tickets.read', 'tickets.write', 'clients.read', 'clients.write'];
const mockSetOpenMobile = jest.fn();
let mockReduceMotion = false;

jest.mock('framer-motion', () => {
  const actual = jest.requireActual('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => mockReduceMotion,
  };
});

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

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

jest.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ setOpenMobile: mockSetOpenMobile }),
}));

const renderDock = () => render(<MobileBottomDock />);

describe('MobileBottomDock', () => {
  beforeEach(() => {
    mockPathname = '/dashboard';
    mockGranted = ['tickets.read', 'tickets.write', 'clients.read', 'clients.write'];
    mockReduceMotion = false;
    mockSetOpenMobile.mockClear();
  });

  it('renders Hoy · Tickets · + · Presupuestos · Más in order', () => {
    renderDock();
    const shell = screen.getByTestId('mobile-dock-shell');
    const labels = Array.from(shell.children).map(
      (slot) =>
        slot.querySelector('a, button')?.getAttribute('aria-label') ?? '',
    );
    expect(labels).toEqual([
      'Hoy',
      'Tickets',
      'Crear',
      'Presupuestos',
      'Más opciones de navegación',
    ]);
  });

  it('puts the active pill on Tickets for ticket detail routes', () => {
    mockPathname = '/tickets/123';
    renderDock();
    const tickets = screen.getByRole('link', { name: 'Tickets' });
    expect(tickets).toHaveAttribute('aria-current', 'page');
    expect(tickets.querySelector('[data-testid="mobile-dock-pill"]')).not.toBeNull();
    expect(screen.getAllByTestId('mobile-dock-pill')).toHaveLength(1);
  });

  it.each(['/presupuestos', '/presupuestos/1069'])(
    'puts the active pill on Presupuestos for %s',
    (path) => {
      mockPathname = path;
      renderDock();
      const tab = screen.getByRole('link', { name: 'Presupuestos' });
      expect(tab).toHaveAttribute('aria-current', 'page');
      expect(screen.getAllByTestId('mobile-dock-pill')).toHaveLength(1);
    },
  );

  it('lights Más on /clients now that Clientes is not a tab', () => {
    mockPathname = '/clients';
    renderDock();
    const more = screen.getByRole('button', { name: /Más/i });
    expect(more.querySelector('[data-testid="mobile-dock-pill"]')).not.toBeNull();
    expect(screen.getAllByTestId('mobile-dock-pill')).toHaveLength(1);
  });

  it('lights Más when the route is not a tab', () => {
    mockPathname = '/anotar';
    renderDock();
    const more = screen.getByRole('button', { name: /Más/i });
    expect(more.querySelector('[data-testid="mobile-dock-pill"]')).not.toBeNull();
  });

  it('opens the create menu with the three quick actions', () => {
    renderDock();
    const plus = screen.getByRole('button', { name: 'Crear' });
    expect(plus).toHaveAttribute('aria-haspopup', 'menu');
    expect(plus).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(plus);

    const menu = screen.getByRole('menu', { name: 'Crear' });
    expect(menu).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Cerrar menú crear' }),
    ).toHaveAttribute('aria-expanded', 'true');
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.getAttribute('href'))).toEqual([
      '/tickets/create',
      '/presupuestos/create',
      '/anotar',
      '/clients/new',
    ]);
    expect(items[0]).toHaveTextContent('Nuevo ticket');
    expect(items[1]).toHaveTextContent('Nuevo presupuesto');
    expect(items[2]).toHaveTextContent('Captura rápida');
    expect(items[3]).toHaveTextContent('Nuevo cliente');
    expect(document.activeElement).toBe(items[0]);
  });

  it('closes the menu on Escape', () => {
    renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(screen.getByRole('menu')).toBeTruthy();

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(screen.getByRole('button', { name: 'Crear' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('closes the menu on an outside pointer', () => {
    renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    act(() => {
      fireEvent.pointerDown(document.body);
    });

    expect(screen.getByRole('button', { name: 'Crear' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('closes the menu when the route changes', () => {
    const { rerender } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(screen.getByRole('menu')).toBeTruthy();

    mockPathname = '/clients';
    rerender(<MobileBottomDock />);

    expect(screen.getByRole('button', { name: 'Crear' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('gates menu items by permission and hides + without any', () => {
    mockGranted = ['tickets.read', 'clients.read', 'clients.write'];
    const { unmount } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
    expect(screen.getByRole('menuitem')).toHaveTextContent('Nuevo cliente');
    unmount();

    mockGranted = ['tickets.read', 'clients.read'];
    renderDock();
    expect(screen.queryByRole('button', { name: 'Crear' })).toBeNull();
  });

  it('opens the Más sheet', () => {
    renderDock();
    fireEvent.click(screen.getByRole('button', { name: /Más/i }));
    expect(mockSetOpenMobile).toHaveBeenCalledWith(true);
  });

  it('works with reduced motion (instant pill and menu, no press scale)', async () => {
    mockReduceMotion = true;
    mockPathname = '/tickets';
    renderDock();
    expect(screen.getAllByTestId('mobile-dock-pill')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(screen.getAllByRole('menuitem')).toHaveLength(4);
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });
});
