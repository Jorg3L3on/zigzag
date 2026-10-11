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

describe('TicketsMobileCard (ZIG-I13-7)', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('shows name and folio, a one-line meta, progress and Pagado / Saldo, and navigates on tap', async () => {
    render(<TicketsMobileCard ticket={ticket} canWrite onDelete={jest.fn()} />);

    expect(screen.getByTestId('ticket-card-name')).toHaveTextContent('Cliente Alfa');
    expect(screen.getByText('#42')).toBeInTheDocument();
    const meta = screen.getByTestId('ticket-card-meta');
    expect(meta).toHaveTextContent('Pago parcial');
    expect(meta).toHaveTextContent('555 123 4567');
    expect(meta).toHaveTextContent('1 may');
    // The phone is text: tapping the card opens the ticket instead of dialing.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: /progreso de pago 40 por ciento/i }),
    ).toBeInTheDocument();
    const money = screen.getByTestId('ticket-payment-summary');
    expect(money).toHaveTextContent('Pagado $100.00');
    expect(money).toHaveTextContent('Saldo $150.00');
    expect(screen.queryByText('Teléfono')).not.toBeInTheDocument();

    await screen.getByRole('button', { name: /editar ticket 42/i }).click();
    expect(mockPush).toHaveBeenCalled();
  });

  it('clamps a long name to two lines and wraps the money instead of truncating', () => {
    render(
      <TicketsMobileCard
        ticket={{
          ...ticket,
          client_name: 'Corporativo Inmobiliario Torres del Caribe S.A. de C.V. Torre B Piso 14 '.repeat(2),
          total: 9999999999.99,
          paid: 1234.57,
        }}
        canWrite
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId('ticket-card-name').className).toContain('line-clamp-2');
    const money = screen.getByTestId('ticket-payment-summary');
    expect(money).toHaveTextContent('Pagado $1,234.57');
    expect(money).toHaveTextContent('Saldo $9,999,998,765.42');
    expect(money.className).toContain('flex-wrap');
    for (const span of Array.from(money.querySelectorAll('span'))) {
      expect(span.className).not.toContain('truncate');
    }
  });

  it('shows Total once and no progress bar for saldado tickets', () => {
    render(
      <TicketsMobileCard
        ticket={{ ...ticket, total: 1972, paid: 1972 }}
        canWrite
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId('ticket-card-meta')).toHaveTextContent('Saldado');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getAllByText('$1,972.00')).toHaveLength(1);
    expect(screen.queryByText(/saldo/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('ticket-payment-summary')).toHaveAttribute(
      'data-payment-status',
      'paid',
    );
  });

  it('shows Sin pagos with the Total when nothing is paid', () => {
    render(
      <TicketsMobileCard
        ticket={{ ...ticket, total: 100, paid: 0 }}
        canWrite
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId('ticket-card-meta')).toHaveTextContent('Sin pagos');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    const money = screen.getByTestId('ticket-payment-summary');
    expect(money).toHaveTextContent('Total');
    expect(money).toHaveTextContent('$100.00');
    expect(money).not.toHaveTextContent('Saldo');
  });

  it('says hoy for a ticket dated today and omits the phone when there is none', () => {
    render(
      <TicketsMobileCard
        ticket={{ ...ticket, client_tel: null, ticket_date: new Date() }}
        canWrite
        onDelete={jest.fn()}
      />,
    );

    const meta = screen.getByTestId('ticket-card-meta');
    expect(meta).toHaveTextContent('hoy');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
