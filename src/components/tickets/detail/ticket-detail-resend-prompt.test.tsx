/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TicketDetailResendPrompt } from '@/components/tickets/detail/ticket-detail-resend-prompt';

const mockReplace = jest.fn();
const mockShare = jest.fn();
const mockRecord = jest.fn();
let mockParams = new URLSearchParams('reenviar=1');

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, refresh: jest.fn() }),
  useSearchParams: () => mockParams,
}));
jest.mock('@/hooks/use-permissions', () => ({ usePermissions: () => ({ can: () => true }) }));
jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 1, name: 'Demo' } }),
}));
jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));
jest.mock('@/actions/tickets', () => ({ recordReceiptShared: (...args: unknown[]) => mockRecord(...args) }));
jest.mock('@/lib/ticket-invoice-download', () => ({
  fetchTicketInvoiceFile: jest.fn(async () => new File(['x'], 't.pdf')),
  shareTicketInvoiceFile: (...args: unknown[]) => mockShare(...args),
  downloadTicketInvoiceFile: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), message: jest.fn() } }));

const props = {
  ticketId: 1123,
  clientName: 'Cliente',
  clientTel: '9981234567',
  total: 4850,
  paid: 1000,
  downloadFileName: 't.pdf',
};

describe('TicketDetailResendPrompt (ZIG-I13-6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = new URLSearchParams('reenviar=1');
    mockShare.mockResolvedValue('shared');
    mockRecord.mockResolvedValue({ success: true });
  });

  it('offers the new recibo with the new total', async () => {
    render(<TicketDetailResendPrompt {...props} />);

    const sheet = await screen.findByRole('dialog', { name: '¿Reenviar el recibo nuevo?' });
    expect(sheet).toHaveTextContent('$4,850.00');
  });

  it('Reenviar recibo shares it, logs the share and clears the offer', async () => {
    const user = userEvent.setup();
    render(<TicketDetailResendPrompt {...props} />);

    await user.click(await screen.findByRole('button', { name: 'Reenviar recibo' }));

    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRecord).toHaveBeenCalledWith(1123, 1));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/tickets/1123', { scroll: false }));
  });

  it('Ahora no only clears the offer', async () => {
    const user = userEvent.setup();
    render(<TicketDetailResendPrompt {...props} />);

    await user.click(await screen.findByRole('button', { name: 'Ahora no' }));

    expect(mockShare).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/tickets/1123', { scroll: false });
  });

  it('shows nothing without ?reenviar=1', () => {
    mockParams = new URLSearchParams();
    render(<TicketDetailResendPrompt {...props} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
