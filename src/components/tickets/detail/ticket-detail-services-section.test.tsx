/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TicketDetailServicesSection } from '@/components/tickets/detail/ticket-detail-services-section';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock('@/hooks/use-permissions', () => ({ usePermissions: () => ({ can: () => true }) }));

const line = (id: number, name: string, materials = 0) => ({
  id,
  quantity: 1,
  price: 100 * id,
  service_id: null,
  name,
  service: null,
  materials: Array.from({ length: materials }, (_, index) => ({
    id: id * 10 + index,
    material_id: null,
    name: `Material ${id}.${index + 1}`,
    unit: 'pza',
    quantity: 2,
    price: 10,
  })),
});

describe('TicketDetailServicesSection (ZIG-I13-4)', () => {
  it('shows three rows with Editar and folds the rest behind Ver detalle con N materiales', async () => {
    const user = userEvent.setup();
    render(
      <TicketDetailServicesSection
        ticketId={5}
        total={1000}
        paid={0}
        services={[line(1, 'Uno', 2), line(2, 'Dos', 1), line(3, 'Tres'), line(4, 'Cuatro', 1)]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Editar servicios' })).toHaveAttribute(
      'href',
      '/tickets/5/services',
    );
    expect(screen.getByText(/Tres/)).toBeInTheDocument();
    expect(screen.queryByText(/Cuatro/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ver detalle con 4 materiales' }));
    expect(screen.getByText(/Cuatro/)).toBeInTheDocument();
    expect(screen.getByText(/Material 1.1/)).toBeInTheDocument();
  });

  it('a settled ticket has no Editar', () => {
    render(
      <TicketDetailServicesSection ticketId={5} total={300} paid={300} services={[line(1, 'Uno')]} />,
    );
    expect(screen.queryByRole('link', { name: 'Editar servicios' })).toBeNull();
  });
});
