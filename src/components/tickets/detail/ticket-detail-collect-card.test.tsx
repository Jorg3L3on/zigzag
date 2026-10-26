/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { TicketDetailCollectCard } from '@/components/tickets/detail/ticket-detail-collect-card';

describe('TicketDetailCollectCard (canvas Cobro)', () => {
  it('lists payments newest first with the long date, and amounts never break', () => {
    render(
      <TicketDetailCollectCard
        total={1343164.79}
        paid={921582.4}
        payments={[
          { id: 1, amount: 500000, created_at: '2026-10-10T14:55:00.000Z' },
          { id: 2, amount: 421582.4, created_at: '2026-10-25T00:28:00.000Z' },
        ]}
        events={[]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Saldo por cobrar' })).toBeInTheDocument();
    expect(screen.getByText('Pagado $921,582.40 · 69 %')).toBeInTheDocument();
    expect(screen.getByText('de $1,343,164.79')).toBeInTheDocument();
    const rows = screen.getAllByTestId('ticket-collect-payment');
    expect(rows[0]).toHaveTextContent('$421,582.40');
    expect(rows[1]).toHaveTextContent('$500,000.00');
    expect(rows[0]).toHaveTextContent(/de octubre de 2026 · \d{2}:\d{2}/);
    for (const row of rows) {
      expect(row.querySelector('[data-money-size]')).toHaveClass('whitespace-nowrap', 'shrink-0');
    }
  });
});
