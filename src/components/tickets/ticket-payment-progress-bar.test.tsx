import { render, screen } from '@testing-library/react';
import {
  getTicketPaymentProgressRatio,
  TicketPaymentProgressBar,
} from '@/components/tickets/ticket-payment-progress-bar';

describe('getTicketPaymentProgressRatio', () => {
  it('returns 0 when total is zero or missing', () => {
    expect(getTicketPaymentProgressRatio(0, 10)).toBe(0);
    expect(getTicketPaymentProgressRatio(null, 10)).toBe(0);
  });

  it('clamps paid ratio between 0 and 1', () => {
    expect(getTicketPaymentProgressRatio(100, 40)).toBeCloseTo(0.4);
    expect(getTicketPaymentProgressRatio(100, 0)).toBe(0);
    expect(getTicketPaymentProgressRatio(100, 150)).toBe(1);
  });
});

describe('TicketPaymentProgressBar', () => {
  it('renders an accessible bar for unpaid tickets', () => {
    render(<TicketPaymentProgressBar total={200} paid={50} />);

    const bar = screen.getByRole('progressbar', {
      name: /progreso de pago 25 por ciento/i,
    });
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(screen.queryByText('25%')).not.toBeInTheDocument();
  });

  it('renders nothing for saldado tickets', () => {
    const { container } = render(
      <TicketPaymentProgressBar total={100} paid={100} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
