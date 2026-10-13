/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TicketCollectProvider } from '@/components/tickets/detail/ticket-detail-collect-context';
import { TicketDetailQuickActions } from '@/components/tickets/detail/ticket-detail-quick-actions';

jest.mock('@/hooks/use-company-payment-info', () => ({
  useCompanyPaymentInfo: () => null,
}));

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock('@/hooks/use-permissions', () => ({ usePermissions: () => ({ can: () => true }) }));
jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 1, name: 'Demo' } }),
}));
jest.mock('@/actions/tickets', () => ({ applyTicketPayment: jest.fn() }));
jest.mock('@/lib/ticket-invoice-download', () => ({
  fetchTicketInvoiceFile: jest.fn(async () => new File(['x'], 't.pdf')),
  shareTicketInvoiceFile: jest.fn(async () => 'shared'),
  downloadTicketInvoiceFile: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), message: jest.fn() } }));

const renderActions = (props: Partial<React.ComponentProps<typeof TicketDetailQuickActions>> = {}) =>
  render(
    <TicketCollectProvider ticketId={7} total={100} paid={40} companyId={1}>
      <TicketDetailQuickActions
        ticketId={7}
        finished
        total={100}
        paid={40}
        clientName="Cliente"
        clientTel="998 123 4567"
        {...props}
      />
    </TicketCollectProvider>,
  );

describe('TicketDetailQuickActions (ZIG-I13-4)', () => {
  it('shows Cobrar, WhatsApp and Llamar for a finalized ticket with a balance', () => {
    renderActions();

    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Compartir recibo' })).toBeNull();
    const whatsApp = screen.getByRole('link', { name: 'WhatsApp' });
    const href = whatsApp.getAttribute('href') ?? '';
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    const text = decodeURIComponent(href.split('?text=')[1]);
    expect(text).toContain('Demo');
    expect(text).toContain('recibo del ticket #7');
    expect(text).toContain('a nombre de Cliente');
    expect(text).toContain('saldo');
    expect(screen.getByRole('link', { name: 'Llamar' })).toHaveAttribute('href', 'tel:9981234567');
  });

  it('Cobrar opens the Cobrar sheet', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: 'Cobrar' }));
    expect(await screen.findByRole('dialog', { name: 'Cobrar' })).toBeInTheDocument();
  });

  it('hides Llamar without a phone and Cobrar once settled', () => {
    renderActions({ clientTel: null, paid: 100 });

    expect(screen.queryByRole('link', { name: 'Llamar' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cobrar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Compartir recibo' })).toBeNull();
  });

  it('an unfinished ticket only offers Llamar', () => {
    renderActions({ finished: false });

    expect(screen.queryByRole('button', { name: 'Cobrar' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Llamar' })).toBeInTheDocument();
  });
});
