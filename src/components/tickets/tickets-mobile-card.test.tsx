import { render, screen } from '@testing-library/react';
import { TicketsMobileCard } from '@/components/tickets/tickets-mobile-card';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/components/tickets/ticket-row-actions', () => ({
  TicketRowActions: () => <button type="button">Acciones</button>,
}));

const ticket = {
  id: BigInt(42),
  client_id: 1,
  client_name: 'Cliente Alfa',
  client_tel: '5551234567',
  email: 'alfa@example.com',
  document: null,
  ticket_date: new Date('2026-05-01T12:00:00Z'),
  total: 250,
  paid: 100,
  finished: false,
  created_at: new Date('2026-05-01T00:00:00Z'),
  updated_at: null,
  deleted_at: null,
  company_id: 1,
};

describe('TicketsMobileCard', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders ticket summary and navigates on click', async () => {
    render(
      <TicketsMobileCard ticket={ticket} canWrite onDelete={jest.fn()} />,
    );

    expect(screen.getByText('Cliente Alfa')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    const phoneLink = screen.getByRole('link', {
      name: /llamar a 5551234567/i,
    });
    expect(phoneLink).toHaveAttribute('href', 'tel:5551234567');
    expect(screen.getByText('Pago parcial')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', {
        name: /progreso de pago 40 por ciento/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getAllByText('$250').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('40%')).not.toBeInTheDocument();

    phoneLink.click();
    expect(mockPush).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: /editar ticket 42/i }).click();
    expect(mockPush).toHaveBeenCalled();
  });
});
