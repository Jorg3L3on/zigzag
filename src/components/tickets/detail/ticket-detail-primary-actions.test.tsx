/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TicketCollectProvider } from '@/components/tickets/detail/ticket-detail-collect-context';
import { TicketDetailPrimaryActions } from '@/components/tickets/detail/ticket-detail-primary-actions';

jest.mock('@/hooks/use-company-payment-info', () => ({
  useCompanyPaymentInfo: () => null,
}));

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
let allowed: (permission: string) => boolean = () => true;
jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: (permission: string) => allowed(permission) }),
}));
jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 1, name: 'Demo' } }),
}));
jest.mock('@/lib/ticket-invoice-download', () => ({
  fetchTicketInvoiceFile: jest.fn(),
  shareTicketInvoiceFile: jest.fn(),
  downloadTicketInvoiceFile: jest.fn(),
}));
jest.mock('@/actions/tickets', () => ({ applyTicketPayment: jest.fn(), deleteTicket: jest.fn() }));
jest.mock('@/components/tripled', () => ({
  TripledMobileStickyActionBar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sticky">{children}</div>
  ),
}));

const baseProps = {
  ticketId: 12,
  clientName: 'Cliente',
  clientTel: null,
  downloadFileName: 't.pdf',
  paymentsCount: 0,
};

const renderActions = (
  props: Partial<React.ComponentProps<typeof TicketDetailPrimaryActions>> & {
    finished: boolean;
    total: number;
    paid: number;
  },
) =>
  render(
    <TicketCollectProvider ticketId={12} total={props.total} paid={props.paid} companyId={1}>
      <TicketDetailPrimaryActions {...baseProps} placement="desktop" {...props} />
    </TicketCollectProvider>,
  );

describe('TicketDetailPrimaryActions (ZIG-I13-4)', () => {
  it('leaves the only Finalizar CTA to the finish panel on unfinished tickets', () => {
    renderActions({ finished: false, total: 100, paid: 0, placement: 'mobile-sticky' });
    expect(screen.queryByTestId('sticky')).toBeNull();

    renderActions({ finished: false, total: 100, paid: 0 });
    expect(screen.queryByRole('button', { name: /registrar pago|compartir recibo/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Terminar ticket' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Descargar PDF' })).toBeNull();
    expect(screen.getByRole('button', { name: /más acciones del ticket/i })).toBeInTheDocument();
  });

  afterEach(() => {
    allowed = () => true;
  });

  it('keeps Cobrar out of the header from lg with a balance, md–lg still opens the sheet (ZIG-I37-4)', async () => {
    const user = userEvent.setup();
    renderActions({ finished: true, total: 100, paid: 40 });

    // From lg the «Saldo por cobrar» card has the only Cobrar; tablet keeps this one.
    const cobrar = screen.getByRole('button', { name: 'Cobrar' });
    expect(cobrar).toHaveClass('lg:hidden', 'h-10', 'rounded-xl', 'text-sm');
    await user.click(cobrar);
    expect(await screen.findByRole('dialog', { name: 'Cobrar' })).toBeInTheDocument();
  });

  it('does not fall back to Compartir recibo from lg with a balance when Cobrar is not allowed', () => {
    allowed = (permission) => permission === 'tickets.read';
    renderActions({ finished: true, total: 100, paid: 40 });

    expect(screen.queryByRole('button', { name: 'Cobrar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Compartir recibo' })).toHaveClass('lg:hidden');
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeInTheDocument();
  });

  it('draws the header buttons in one size: h-10, rounded-xl, text-sm, ⋯ a 40px outline square', () => {
    renderActions({ finished: true, total: 100, paid: 100, clientTel: '998 123 4567' });

    for (const button of [
      screen.getByRole('button', { name: 'Compartir recibo' }),
      screen.getByRole('button', { name: 'Descargar PDF' }),
    ]) {
      expect(button).toHaveClass('h-10', 'rounded-xl', 'text-sm');
    }
    const more = screen.getByRole('button', { name: /más acciones del ticket/i });
    expect(more).toHaveClass('h-10', 'w-10', 'rounded-xl', 'border', 'border-input');
    expect(screen.getByTestId('ticket-detail-header-actions')).toHaveClass('lg:@min-[48rem]:flex-nowrap');
  });

  it('drops ⋯ from lg for a read-only user with nothing to share there, PDF stays', () => {
    allowed = (permission) => permission === 'tickets.read';
    renderActions({ finished: true, total: 100, paid: 40 });

    expect(screen.getByRole('button', { name: /más acciones del ticket/i })).toHaveClass('lg:hidden');
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toHaveClass('lg:inline-flex');
    expect(screen.queryByRole('link', { name: /editar/i })).toBeNull();
    expect(screen.getByTestId('ticket-detail-header-actions')).not.toHaveClass('lg:hidden');
  });

  it('offers no Terminar ticket to a read-only user (the finish panel is not there for them)', () => {
    allowed = (permission) => permission === 'tickets.read';
    renderActions({ finished: false, total: 100, paid: 0 });

    expect(screen.queryByRole('button', { name: 'Terminar ticket' })).toBeNull();
    expect(screen.getByTestId('ticket-detail-header-actions')).toHaveClass('lg:hidden');
  });

  it('hides the whole cluster from lg when no button is left there', () => {
    allowed = () => false;
    renderActions({ finished: true, total: 100, paid: 40 });

    expect(screen.getByTestId('ticket-detail-header-actions')).toHaveClass('lg:hidden');
    expect(screen.queryByRole('button', { name: /más acciones/i })).toBeNull();
  });

  it('offers Compartir recibo once saldado', () => {
    renderActions({ finished: true, total: 100, paid: 100 });

    expect(screen.getByRole('button', { name: 'Compartir recibo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cobrar' })).toBeNull();
  });

  it('puts the primary action in the mobile sticky bar, the menu stays in the app bar', () => {
    renderActions({ finished: true, total: 80, paid: 0, placement: 'mobile-sticky' });

    expect(screen.getByTestId('sticky')).toHaveTextContent('Cobrar');
    expect(screen.queryByRole('button', { name: /más acciones/i })).toBeNull();
    // Phones keep WhatsApp in the quick-action tiles, not in the sticky bar.
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).toBeNull();
  });

  it('puts WhatsApp in ⋯ from 1024px when the client has a phone, not in the header (2026-11-11)', async () => {
    const user = userEvent.setup();
    renderActions({ finished: true, total: 100, paid: 40, clientTel: '998 123 4567' });

    expect(screen.queryByRole('link', { name: 'WhatsApp' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /más acciones del ticket/i }));
    const whatsApp = screen.getByRole('menuitem', { name: 'WhatsApp' });
    expect(whatsApp).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/\d+\?text=/));
    expect(whatsApp).toHaveClass('hidden', 'lg:flex');
    // With a balance there is no recibo to share yet.
    expect(screen.queryByRole('menuitem', { name: 'Compartir recibo' })).toBeNull();
  });

  it('moves Compartir recibo and WhatsApp into ⋯ from 1024px once saldado (2026-11-11)', async () => {
    const user = userEvent.setup();
    allowed = (permission) => permission === 'tickets.read';
    renderActions({ finished: true, total: 100, paid: 100, clientTel: '998 123 4567' });

    expect(screen.getByRole('button', { name: 'Compartir recibo' })).toHaveClass('lg:hidden');
    const more = screen.getByRole('button', { name: /más acciones del ticket/i });
    // Read-only: ⋯ stays from lg because it holds the share items.
    expect(more).not.toHaveClass('lg:hidden');
    await user.click(more);
    const items = screen.getAllByRole('menuitem');
    expect(items[0]).toHaveTextContent('Compartir recibo');
    expect(items[0]).toHaveClass('hidden', 'lg:flex');
    expect(items[1]).toHaveTextContent('WhatsApp');
  });

  it('has a PDF button that downloads the recibo, from 1024px (ZIG-I24)', async () => {
    const user = userEvent.setup();
    const invoice = jest.requireMock('@/lib/ticket-invoice-download') as {
      fetchTicketInvoiceFile: jest.Mock;
      downloadTicketInvoiceFile: jest.Mock;
    };
    const file = new File(['%PDF'], 't.pdf');
    invoice.fetchTicketInvoiceFile.mockResolvedValue(file);
    renderActions({ finished: true, total: 100, paid: 40 });

    const pdf = screen.getByRole('button', { name: 'Descargar PDF' });
    expect(pdf).toHaveTextContent('PDF');
    expect(pdf).toHaveClass('hidden', 'lg:inline-flex');
    await user.click(pdf);
    expect(invoice.downloadTicketInvoiceFile).toHaveBeenCalledWith(file);
  });

  it('offers no WhatsApp without a phone or before the ticket is finished', async () => {
    const user = userEvent.setup();
    const { unmount } = renderActions({ finished: true, total: 100, paid: 100 });
    await user.click(screen.getByRole('button', { name: /más acciones del ticket/i }));
    expect(screen.queryByRole('menuitem', { name: 'WhatsApp' })).toBeNull();
    await user.keyboard('{Escape}');
    unmount();

    renderActions({ finished: false, total: 100, paid: 0, clientTel: '998 123 4567' });
    await user.click(screen.getByRole('button', { name: /más acciones del ticket/i }));
    expect(screen.queryByRole('menuitem', { name: 'WhatsApp' })).toBeNull();
  });
});
