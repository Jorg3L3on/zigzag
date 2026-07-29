import { render, screen } from '@testing-library/react';
import { TicketListPaymentSummary } from '@/components/tickets/ticket-list-payment-summary';

describe('TicketListPaymentSummary', () => {
  it('shows status, bar and paid/total percent for partial payments', () => {
    render(<TicketListPaymentSummary total={35000} paid={15000} />);

    expect(screen.getByText('Pago parcial')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', {
        name: /progreso de pago 43 por ciento/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('$15,000.00')).toBeInTheDocument();
    expect(screen.getByText('$35,000.00')).toBeInTheDocument();
    expect(screen.getByText('43%')).toBeInTheDocument();
    expect(screen.getByText(/de/)).toBeInTheDocument();
  });

  it('shows status, bar and amounts for pending (zero paid)', () => {
    render(<TicketListPaymentSummary total={100} paid={0} />);

    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', {
        name: /progreso de pago 0 por ciento/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows only the status label for saldado tickets', () => {
    render(<TicketListPaymentSummary total={100} paid={100} />);

    expect(screen.getByText('Saldado')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
