/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { TicketPaymentCollectSection } from '@/components/tickets/ticket-payment-collect-section';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    can: () => true,
  }),
}));

jest.mock('@/actions/tickets', () => ({
  applyTicketPayment: jest.fn(),
}));

describe('TicketPaymentCollectSection', () => {
  it('shows collect UI for finished pending tickets with $0 paid', () => {
    render(
      <TicketPaymentCollectSection
        ticketId={9}
        total={200}
        paid={0}
        finished
        payments={[]}
      />,
    );

    expect(screen.getByText('Sin pagos registrados')).toBeInTheDocument();
    expect(screen.getByText('Registrar cobro')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /saldar el ticket por completo/i }),
    ).toBeInTheDocument();
  });

  it('hides collect UI when saldado', () => {
    render(
      <TicketPaymentCollectSection
        ticketId={9}
        total={200}
        paid={200}
        finished
        payments={[{ id: 1, amount: 200, created_at: new Date() }]}
      />,
    );

    expect(screen.getByText('Pago completado')).toBeInTheDocument();
    expect(screen.queryByText('Registrar cobro')).not.toBeInTheDocument();
  });
});
