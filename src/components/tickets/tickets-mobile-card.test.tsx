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
    expect(screen.getByText('$250')).toBeInTheDocument();
    expect(screen.getByText('$150')).toBeInTheDocument();
    expect(screen.getByText(/faltan/i)).toBeInTheDocument();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.queryByText('40%')).not.toBeInTheDocument();

    phoneLink.click();
    expect(mockPush).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: /editar ticket 42/i }).click();
    expect(mockPush).toHaveBeenCalled();
  });

  it('shows the amount once and no progress bar for saldado tickets', () => {
    render(
      <TicketsMobileCard
        ticket={{ ...ticket, total: 1972, paid: 1972 }}
        canWrite
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText('Saldado')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getAllByText('$1,972.00')).toHaveLength(1);
    expect(screen.queryByText(/faltan/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('ticket-payment-summary')).toHaveAttribute(
      'data-payment-status',
      'paid',
    );
  });

  it('shows progress and balance for pending tickets', () => {
    render(
      <TicketsMobileCard
        ticket={{ ...ticket, total: 100, paid: 0 }}
        canWrite
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: /progreso de pago 0 por ciento/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getAllByText('$100')).toHaveLength(2);
  });
});
