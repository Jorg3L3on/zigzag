/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';

import type { ClientDetailPayment, ClientDetailTicket } from '@/actions/client-detail';
import { ClientHistorySections } from '@/components/clients/detail/client-history-sections';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const ticket = (n: number): ClientDetailTicket => ({
  id: String(n),
  folio: `R-${String(n).padStart(4, '0')}`,
  ticketDate: '2026-10-10T12:00:00.000Z',
  createdAt: '2026-10-10T12:00:00.000Z',
  workNotes: null,
  total: 100,
  paid: 100,
  balanceDue: 0,
  finished: true,
  paymentStatus: 'paid',
});

const payment = (n: number): ClientDetailPayment => ({
  id: n,
  ticketId: String(n),
  ticketFolio: `R-${String(n).padStart(4, '0')}`,
  amount: 100,
  createdAt: '2026-10-10T12:00:00.000Z',
});

const sectionOrder = () =>
  screen
    .getAllByTestId(/^client-section-/)
    .map((node) => node.getAttribute('data-testid'));

describe('ClientHistorySections preview (M-14)', () => {
  it('counts every ticket and pago, links the full list and puts Recordatorios first', () => {
    render(
      <ClientHistorySections
        tickets={Array.from({ length: 10 }, (_, i) => ticket(i + 1))}
        ticketTotal={400}
        allTicketsHref="/tickets?q=Cliente%20Grande"
        presupuestos={[]}
        payments={Array.from({ length: 10 }, (_, i) => payment(i + 1))}
        paymentTotal={250}
        schedules={[]}
      />,
    );

    const tickets = screen.getByTestId('client-section-tickets');
    expect(within(tickets).getByRole('heading', { name: /Tickets\s*400/ })).toBeInTheDocument();
    const link = screen.getByTestId('client-all-tickets-link');
    expect(link).toHaveTextContent('Ver los 400 tickets');
    expect(link).toHaveAttribute('href', '/tickets?q=Cliente%20Grande');
    expect(
      within(screen.getByTestId('client-section-pagos')).getByRole('heading', { name: /Pagos\s*250/ }),
    ).toBeInTheDocument();
    expect(sectionOrder().slice(0, 2)).toEqual([
      'client-section-recordatorios',
      'client-section-tickets',
    ]);
  });

  it('shows no link when every ticket is listed', () => {
    render(
      <ClientHistorySections
        tickets={[ticket(1), ticket(2)]}
        allTicketsHref="/tickets?q=x"
        presupuestos={[]}
        payments={[]}
        schedules={[]}
      />,
    );
    expect(screen.queryByTestId('client-all-tickets-link')).toBeNull();
  });
});
