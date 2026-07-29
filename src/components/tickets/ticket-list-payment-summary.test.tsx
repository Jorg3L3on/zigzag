import { render, screen } from '@testing-library/react';
import { TicketListPaymentSummary } from '@/components/tickets/ticket-list-payment-summary';

describe('TicketListPaymentSummary', () => {
  it('shows status, bar and paid/total without percent for partial payments', () => {
    render(<TicketListPaymentSummary total={35000} paid={15000} />);

    const summary = screen.getByTestId('ticket-payment-summary');
    expect(summary).toHaveAttribute('data-payment-status', 'partial');
    expect(screen.getByText('Pago parcial')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', {
        name: /progreso de pago 43 por ciento/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('$15,000')).toBeInTheDocument();
    expect(screen.getByText('$35,000')).toBeInTheDocument();
    expect(screen.getByText(/de/)).toBeInTheDocument();
    expect(screen.queryByText('43%')).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('shows status, bar and amounts for pending (zero paid)', () => {
    render(<TicketListPaymentSummary total={100} paid={0} />);

    expect(screen.getByTestId('ticket-payment-summary')).toHaveAttribute(
      'data-payment-status',
      'pending',
    );
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', {
        name: /progreso de pago 0 por ciento/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('keeps bar and amounts for saldado tickets for even row height', () => {
    render(<TicketListPaymentSummary total={100} paid={100} />);

    expect(screen.getByTestId('ticket-payment-summary')).toHaveAttribute(
      'data-payment-status',
      'paid',
    );
    expect(screen.getByText('Saldado')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', {
        name: /progreso de pago 100 por ciento/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('$100')).toHaveLength(2);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
