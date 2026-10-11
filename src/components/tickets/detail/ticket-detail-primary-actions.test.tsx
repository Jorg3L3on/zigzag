/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TicketCollectProvider } from '@/components/tickets/detail/ticket-detail-collect-context';
import { TicketDetailPrimaryActions } from '@/components/tickets/detail/ticket-detail-primary-actions';

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
    expect(screen.getByRole('button', { name: /más acciones del ticket/i })).toBeInTheDocument();
  });

  it('Registrar pago opens the cobro sheet when finished with a balance', async () => {
    const user = userEvent.setup();
    renderActions({ finished: true, total: 100, paid: 40 });

    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(await screen.findByRole('dialog', { name: 'Registrar pago' })).toBeInTheDocument();
  });

  it('offers Compartir recibo once saldado', () => {
    renderActions({ finished: true, total: 100, paid: 100 });

    expect(screen.getByRole('button', { name: 'Compartir recibo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).toBeNull();
  });

  it('puts the primary action in the mobile sticky bar, the menu stays in the app bar', () => {
    renderActions({ finished: true, total: 80, paid: 0, placement: 'mobile-sticky' });

    expect(screen.getByTestId('sticky')).toHaveTextContent('Registrar pago');
    expect(screen.queryByRole('button', { name: /más acciones/i })).toBeNull();
  });
});
