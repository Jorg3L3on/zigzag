/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { TicketDetailHero } from '@/components/tickets/detail/ticket-detail-hero';
import { TicketDetailStatusPill } from '@/components/tickets/detail/ticket-detail-status-pill';

describe('TicketDetailHero (ZIG-I13-4)', () => {
  it('leads with Saldo por cobrar, progress and Pagado X de Y', () => {
    render(<TicketDetailHero finished total={2946630} paid={1767978} />);

    expect(screen.getByText('Saldo por cobrar')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-hero-amount')).toHaveTextContent('$1,178,652.00');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByTestId('ticket-hero-paid')).toHaveTextContent(
      'Pagado $1,767,978.00 de $2,946,630.00',
    );
  });

  it('a settled ticket says Pagado with the total', () => {
    render(<TicketDetailHero finished total={500} paid={500} />);

    expect(screen.getByText('Pagado')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-hero-amount')).toHaveTextContent('$500.00');
    expect(screen.getByTestId('ticket-hero-paid')).toHaveTextContent('Saldado');
  });

  it('an unfinished ticket shows its Total and no progress bar', () => {
    render(<TicketDetailHero finished={false} total={1200} paid={0} />);

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-hero-amount')).toHaveTextContent('$1,200.00');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('never truncates a 10-digit balance', () => {
    render(<TicketDetailHero finished total={9999999999.99} paid={0} />);
    const amount = screen.getByTestId('ticket-hero-amount');
    expect(amount).toHaveTextContent('$9,999,999,999.99');
    expect(amount.className).toContain('[overflow-wrap:anywhere]');
  });
});

describe('TicketDetailStatusPill', () => {
  it.each([
    [false, 100, 0, 'En proceso'],
    [true, 100, 0, 'Sin pagos'],
    [true, 100, 40, 'Pago parcial'],
    [true, 100, 100, 'Pagado'],
  ])('finished=%s total=%s paid=%s → %s', (finished, total, paid, label) => {
    render(<TicketDetailStatusPill finished={finished} total={total} paid={paid} />);
    expect(screen.getByTestId('ticket-status-pill')).toHaveTextContent(label);
  });
});
