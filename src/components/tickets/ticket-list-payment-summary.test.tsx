import { render, screen } from '@testing-library/react';
import { TicketListPaymentSummary } from '@/components/tickets/ticket-list-payment-summary';

describe('TicketListPaymentSummary', () => {
  it('shows badge, ring, pagado and por pagar for partial payments', () => {
    render(<TicketListPaymentSummary total={200} paid={50} />);

    expect(screen.getByText('Pago parcial')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /progreso de pago 25 por ciento/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pagado')).toBeInTheDocument();
    expect(screen.getByText('Por pagar')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
  });

  it('shows badge, ring and amounts for pending (zero paid)', () => {
    render(<TicketListPaymentSummary total={100} paid={0} />);

    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /progreso de pago 0 por ciento/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });

  it('shows only the badge for saldado tickets', () => {
    render(<TicketListPaymentSummary total={100} paid={100} />);

    expect(screen.getByText('Saldado')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('Pagado')).not.toBeInTheDocument();
    expect(screen.queryByText('Por pagar')).not.toBeInTheDocument();
  });
});
