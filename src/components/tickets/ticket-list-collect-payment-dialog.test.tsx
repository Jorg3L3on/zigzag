import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  getCollectQuickAmounts,
  TicketListCollectPaymentDialog,
} from '@/components/tickets/ticket-list-collect-payment-dialog';

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

  const renderDialog = (props: Partial<React.ComponentProps<typeof TicketListCollectPaymentDialog>> = {}) =>
    render(
      <TicketListCollectPaymentDialog
        open
        onOpenChange={onOpenChange}
        ticketId={7}
        total={100}
        paid={20}
        onPaymentApplied={onPaymentApplied}
        {...props}
      />,
    );

  it('leads with Pagó todo for the full balance and no banking words', async () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /pagó todo · \$80\.00/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagó una parte' })).toBeInTheDocument();
    expect(screen.queryByText(/abon|saldar|registrar/i)).not.toBeInTheDocument();
  });

  it('Pagó todo records the full balance', async () => {
    const user = userEvent.setup();
    mockApplyTicketPayment.mockResolvedValue({ success: true, data: { paid: 100 } });
    renderDialog({ paid: 40, companyId: 10 });

    await user.click(screen.getByRole('button', { name: /pagó todo/i }));

    await waitFor(() => {
      expect(mockApplyTicketPayment).toHaveBeenCalledWith(7, 60, 10);
      expect(onPaymentApplied).toHaveBeenCalledWith({ ticketId: 7, paid: 100, total: 100 });
    });
  });

  it('Pagó una parte reveals a labelled peso field and records the amount', async () => {
    const user = userEvent.setup();
    mockApplyTicketPayment.mockResolvedValue({ success: true, data: { paid: 50 } });
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Pagó una parte' }));
    const input = screen.getByLabelText('¿Cuánto pagó?');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    await user.type(input, '30');
    await user.click(screen.getByRole('button', { name: 'Anotar este pago' }));

    await waitFor(() => {
      expect(mockApplyTicketPayment).toHaveBeenCalledWith(7, 30, null);
      expect(onPaymentApplied).toHaveBeenCalledWith({ ticketId: 7, paid: 50, total: 100 });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });

  it('rejects an amount above the balance inline', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Pagó una parte' }));
    await user.type(screen.getByLabelText('¿Cuánto pagó?'), '500');
    await user.click(screen.getByRole('button', { name: 'Anotar este pago' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/más de lo que debe/i);
    expect(mockApplyTicketPayment).not.toHaveBeenCalled();
  });

  it('quick chips fill the amount', async () => {
    const user = userEvent.setup();
    renderDialog({ total: 3000, paid: 0 });

    await user.click(screen.getByRole('button', { name: 'Pagó una parte' }));
    await user.click(screen.getByRole('button', { name: 'La mitad' }));
    expect(screen.getByLabelText('¿Cuánto pagó?')).toHaveValue('1500');
  });
});

describe('getCollectQuickAmounts', () => {
  it('offers half and round amounts below the balance', () => {
    expect(getCollectQuickAmounts(3000).map((c) => c.amount)).toEqual([1500, 500, 1000]);
    expect(getCollectQuickAmounts(80).map((c) => c.amount)).toEqual([40]);
  });
});
