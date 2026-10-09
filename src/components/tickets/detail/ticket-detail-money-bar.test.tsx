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
