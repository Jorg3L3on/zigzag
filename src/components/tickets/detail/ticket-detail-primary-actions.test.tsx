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
jest.mock('@/hooks/use-permissions', () => ({ usePermissions: () => ({ can: () => true }) }));
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

  it('Cobrar opens the Cobrar sheet when finished with a balance', async () => {
    const user = userEvent.setup();
    renderActions({ finished: true, total: 100, paid: 40 });

    await user.click(screen.getByRole('button', { name: 'Cobrar' }));
    expect(await screen.findByRole('dialog', { name: 'Cobrar' })).toBeInTheDocument();
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

  it('puts WhatsApp with the header actions from 1024px when the client has a phone (ZIG-I24)', () => {
    renderActions({ finished: true, total: 100, paid: 40, clientTel: '998 123 4567' });

    const whatsApp = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsApp).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/\d+\?text=/));
    expect(whatsApp).toHaveClass('hidden', 'lg:inline-flex');
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

  it('offers no WhatsApp without a phone or before the ticket is finished', () => {
    renderActions({ finished: true, total: 100, paid: 100 });
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).toBeNull();

    renderActions({ finished: false, total: 100, paid: 0, clientTel: '998 123 4567' });
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).toBeNull();
  });
});
