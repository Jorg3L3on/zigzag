import { render, screen } from '@testing-library/react';
import {
  getTicketPaymentProgressRatio,
  TicketPaymentProgressRing,
} from '@/components/tickets/ticket-payment-progress-ring';

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

describe('TicketPaymentProgressRing', () => {
  it('renders an accessible ring without numeric percent text for unpaid tickets', () => {
    render(<TicketPaymentProgressRing total={200} paid={50} />);

    const ring = screen.getByRole('img', {
      name: /progreso de pago 25 por ciento/i,
    });
    expect(ring).toBeInTheDocument();
    expect(ring.textContent).toBe('');
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText('25%')).not.toBeInTheDocument();
  });

  it('renders nothing for saldado tickets', () => {
    const { container } = render(
      <TicketPaymentProgressRing total={100} paid={100} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
