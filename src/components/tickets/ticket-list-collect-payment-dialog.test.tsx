import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketListCollectPaymentDialog } from '@/components/tickets/ticket-list-collect-payment-dialog';

const mockApplyTicketPayment = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/actions/tickets', () => ({
  applyTicketPayment: (...args: unknown[]) => mockApplyTicketPayment(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('TicketListCollectPaymentDialog', () => {
  const onOpenChange = jest.fn();
  const onPaymentApplied = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid amounts and does not call the action', async () => {
    const user = userEvent.setup();
    render(
      <TicketListCollectPaymentDialog
        open
        onOpenChange={onOpenChange}
        ticketId={7}
        total={100}
        paid={20}
        onPaymentApplied={onPaymentApplied}
      />,
    );

    expect(screen.getByText('Registrar pago')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Pagado')).toBeInTheDocument();
    expect(screen.getByText('Por pagar')).toBeInTheDocument();
    expect(screen.queryByText(/historial/i)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /registrar abono al saldo/i }),
    );
    expect(mockToastError).toHaveBeenCalled();
    expect(mockApplyTicketPayment).not.toHaveBeenCalled();
  });

  it('registers an abono and notifies the parent on success', async () => {
    const user = userEvent.setup();
    mockApplyTicketPayment.mockResolvedValue({
      success: true,
      data: { paid: 50 },
    });

    render(
      <TicketListCollectPaymentDialog
        open
        onOpenChange={onOpenChange}
        ticketId={7}
        total={100}
        paid={20}
        onPaymentApplied={onPaymentApplied}
      />,
    );

    await user.clear(screen.getByLabelText(/monto a abonar/i));
    await user.type(screen.getByLabelText(/monto a abonar/i), '30');
    await user.click(
      screen.getByRole('button', { name: /registrar abono al saldo/i }),
    );

    await waitFor(() => {
      expect(mockApplyTicketPayment).toHaveBeenCalledWith(7, 30, null);
      expect(onPaymentApplied).toHaveBeenCalledWith({
        ticketId: 7,
        paid: 50,
        total: 100,
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });

  it('settles the full balance', async () => {
    const user = userEvent.setup();
    mockApplyTicketPayment.mockResolvedValue({
      success: true,
      data: { paid: 100 },
    });

    render(
      <TicketListCollectPaymentDialog
        open
        onOpenChange={onOpenChange}
        ticketId={7}
        total={100}
        paid={40}
        companyId={10}
        onPaymentApplied={onPaymentApplied}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /saldar el ticket por completo/i }),
    );

    await waitFor(() => {
      expect(mockApplyTicketPayment).toHaveBeenCalledWith(7, 60, 10);
      expect(onPaymentApplied).toHaveBeenCalledWith({
        ticketId: 7,
        paid: 100,
        total: 100,
      });
    });
  });
});
