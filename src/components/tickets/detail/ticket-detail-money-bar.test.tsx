/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { TicketDetailMoneyBar } from '@/components/tickets/detail/ticket-detail-money-bar';

describe('TicketDetailMoneyBar', () => {
  it('never says "Sin total": shows $0.00 and Sin pagos for an empty ticket', () => {
    render(<TicketDetailMoneyBar total={null} paid={null} />);

    expect(screen.queryByText('Sin total')).toBeNull();
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Sin pagos')).toBeTruthy();
  });

  it('shows the paid amount once there are payments', () => {
    render(<TicketDetailMoneyBar total={150} paid={50} />);

    expect(screen.getByText('$150.00')).toBeTruthy();
    expect(screen.getByText('$50.00')).toBeTruthy();
    expect(screen.queryByText('Sin pagos')).toBeNull();
  });
});

describe('TicketDetailMoneyBar with 10-digit amounts (ZIG-I12)', () => {
  it('stacks Total, Pagado and Saldo and never truncates them', () => {
    const { container } = render(
      <TicketDetailMoneyBar total={9_900_124_059.38} paid={1_234.5} />,
    );

    const grid = container.querySelector('[data-stacked="true"]');
    expect(grid).not.toBeNull();
    expect(screen.getByText('$9,900,124,059.38')).toBeTruthy();
    expect(screen.getByText('$9,900,122,824.88')).toBeTruthy();
    expect(container.querySelector('.truncate')).toBeNull();
  });

  it('keeps three columns for ordinary amounts', () => {
    const { container } = render(<TicketDetailMoneyBar total={1500} paid={500} />);

    expect(container.querySelector('[data-stacked]')).toBeNull();
  });
});
