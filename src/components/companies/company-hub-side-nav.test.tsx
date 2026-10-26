import { render, screen } from '@testing-library/react';
import { CompanyHubSideNav } from '@/components/companies/company-hub-side-nav';

const mockPathname = jest.fn(() => '/company');
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname() }));

describe('CompanyHubSideNav (ZIG-I32-1)', () => {
  it('lists the Datos sections as anchors, then Hub with Equipo and Roles counts', () => {
    render(
      <CompanyHubSideNav
        visibleTabs={['datos', 'equipo', 'roles']}
        counts={{ equipo: 5, roles: 3 }}
      />,
    );

    expect(screen.getByText('Datos')).toBeInTheDocument();
    expect(screen.getByText('Hub')).toBeInTheDocument();
    // The section in view (Perfil at the top) is highlighted.
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('link', { name: 'Dirección' })).toHaveAttribute('href', '#direccion');
    expect(screen.getByRole('link', { name: 'Pagos por transferencia' })).toHaveAttribute(
      'href',
      '#pagos',
    );
    expect(screen.getByRole('link', { name: 'Equipo 5' })).toHaveAttribute('href', '/company/equipo');
    expect(screen.getByRole('link', { name: 'Roles 3' })).toBeInTheDocument();
  });

  it('points the anchors back to /company from another tab and hides tabs without permission', () => {
    mockPathname.mockReturnValue('/company/equipo');
    render(<CompanyHubSideNav visibleTabs={['datos', 'equipo']} />);

    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', '/company#perfil');
    expect(screen.getByRole('link', { name: /Equipo/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: /Roles/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Perfil' })).not.toHaveAttribute('aria-current');
  });

  it('hides the Datos group without company.manage', () => {
    mockPathname.mockReturnValue('/company/equipo');
    render(<CompanyHubSideNav visibleTabs={['equipo', 'roles']} />);

    expect(screen.queryByText('Datos')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Perfil' })).toBeNull();
  });
});
