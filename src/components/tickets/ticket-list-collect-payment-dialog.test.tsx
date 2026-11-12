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

const mockUseIsMobile = jest.fn(() => true);
jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mockUseIsMobile() }));


describe('TicketListCollectPaymentDialog (phone sheet)', () => {
  const onOpenChange = jest.fn();
  const onPaymentApplied = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsMobile.mockReturnValue(true);
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

describe('TicketListCollectPaymentDialog (desktop shortcuts, ZIG-I31-3)', () => {
  const onOpenChange = jest.fn();
  const onPaymentApplied = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
  });

  const renderDialog = (props: Partial<React.ComponentProps<typeof TicketListCollectPaymentDialog>> = {}) =>
    render(
      <TicketListCollectPaymentDialog
        open
        onOpenChange={onOpenChange}
        ticketId={16}
        total={1210}
        paid={10}
        folio="R-0016"
        clientName="Museo de Arte Contemporáneo"
        clientTel="9613151559"
        companyName="ClimaTotal Demo"
        onPaymentApplied={onPaymentApplied}
        {...props}
      />,
    );

  it('names the ticket and the client, and starts with the whole saldo', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Cobrar ticket R-0016' })).toBeInTheDocument();
    expect(screen.getByText('Museo de Arte Contemporáneo')).toBeInTheDocument();
    expect(screen.getByText('Saldo pendiente')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Todo el saldo' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'La mitad · $600.00' })).toBeInTheDocument();
    expect(screen.getByLabelText('¿Cuánto pagó?')).toHaveValue('1,200');
    expect(screen.getByRole('button', { name: 'Anotar cobro' })).toBeInTheDocument();
    expect(screen.queryByText(/abon|saldar|registrar/i)).not.toBeInTheDocument();
  });

  it('La mitad fills half and Otro monto clears the field', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('radio', { name: /^La mitad/ }));
    expect(screen.getByLabelText('¿Cuánto pagó?')).toHaveValue('600');
    await user.click(screen.getByRole('radio', { name: 'Otro monto' }));
    expect(screen.getByLabelText('¿Cuánto pagó?')).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Otro monto' })).toHaveAttribute('aria-checked', 'true');
  });

  it('settling the ticket offers Enviar recibo by WhatsApp', async () => {
    const user = userEvent.setup();
    mockApplyTicketPayment.mockResolvedValue({ success: true, data: { paid: 1210 } });
    renderDialog({ companyId: 4, settledDescription: 'La fila sale de Cobranza y la franja se actualiza.' });

    await user.click(screen.getByRole('button', { name: 'Anotar cobro' }));

    await waitFor(() => {
      expect(mockApplyTicketPayment).toHaveBeenCalledWith(16, 1200, 4);
      expect(onPaymentApplied).toHaveBeenCalledWith({ ticketId: 16, paid: 1210, total: 1210 });
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Listo, quedó pagado',
      expect.objectContaining({
        description: 'La fila sale de Cobranza y la franja se actualiza.',
        action: expect.objectContaining({ label: 'Enviar recibo' }),
      }),
    );
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    const [, options] = mockToastSuccess.mock.calls[0] as [string, { action: { onClick: () => void } }];
    options.action.onClick();
    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/wa\.me\/9613151559\?text=.*R-0016/),
      '_blank',
      'noopener,noreferrer',
    );
    open.mockRestore();
  });

  it('a smaller amount is a partial payment without the receipt offer', async () => {
    const user = userEvent.setup();
    mockApplyTicketPayment.mockResolvedValue({ success: true, data: { paid: 610 } });
    renderDialog();

    await user.click(screen.getByRole('radio', { name: /^La mitad/ }));
    await user.click(screen.getByRole('button', { name: 'Anotar cobro' }));

    await waitFor(() => expect(mockApplyTicketPayment).toHaveBeenCalledWith(16, 600, null));
    expect(mockToastSuccess).toHaveBeenCalledWith('Cobro anotado');
  });

  it('keeps the same validations', async () => {
    const user = userEvent.setup();
    renderDialog();
    const input = screen.getByLabelText('¿Cuánto pagó?');
    await user.clear(input);
    await user.type(input, '5000');
    await user.click(screen.getByRole('button', { name: 'Anotar cobro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/más de lo que debe/i);
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Anotar cobro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe cuánto te pagó.');
    expect(mockApplyTicketPayment).not.toHaveBeenCalled();
  });

  it('without a phone the full payment toast has no receipt action', async () => {
    const user = userEvent.setup();
    mockApplyTicketPayment.mockResolvedValue({ success: true, data: { paid: 1210 } });
    renderDialog({ clientTel: null, folio: null });
    expect(screen.getByRole('dialog', { name: 'Cobrar' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Anotar cobro' }));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Listo, quedó pagado'));
  });
});

describe('getCollectQuickAmounts', () => {
  it('offers half and round amounts below the balance', () => {
    expect(getCollectQuickAmounts(3000).map((c) => c.amount)).toEqual([1500, 500, 1000]);
    expect(getCollectQuickAmounts(80).map((c) => c.amount)).toEqual([40]);
  });
});
