/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TicketDetailActionsMenu } from '@/components/tickets/detail/ticket-detail-actions-menu';

const mockPush = jest.fn();
const mockDeleteTicket = jest.fn();
let mockCan = () => true;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock('@/hooks/use-permissions', () => ({ usePermissions: () => ({ can: () => mockCan() }) }));
jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 1, name: 'Demo' } }),
}));
jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));
jest.mock('@/actions/tickets', () => ({ deleteTicket: (...args: unknown[]) => mockDeleteTicket(...args) }));
jest.mock('@/lib/ticket-invoice-download', () => ({
  fetchTicketInvoiceFile: jest.fn(async () => new File(['x'], 't.pdf')),
  shareTicketInvoiceFile: jest.fn(),
  downloadTicketInvoiceFile: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), message: jest.fn() } }));

const props = {
  ticketId: 1123,
  clientName: 'Corporativo Torres',
  clientTel: '9981234567',
  total: 2946630,
  paid: 1767978,
  paymentsCount: 1,
  downloadFileName: 't.pdf',
};

describe('TicketDetailActionsMenu (ZIG-I13-4)', () => {
  beforeEach(() => {
    mockCan = () => true;
    mockPush.mockReset();
    mockDeleteTicket.mockReset();
  });

  it('has Editar servicios, Descargar PDF, Duplicar ticket and Eliminar ticket', async () => {
    const user = userEvent.setup();
    render(<TicketDetailActionsMenu {...props} />);

    await user.click(screen.getByRole('button', { name: 'Más acciones del ticket' }));
    expect(screen.getByRole('menuitem', { name: 'Editar servicios' })).toHaveAttribute(
      'href',
      '/tickets/1123/services',
    );
    expect(screen.getByRole('menuitem', { name: 'Descargar PDF' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicar ticket' })).toHaveAttribute(
      'href',
      '/tickets/create?duplicate=1123',
    );
    expect(screen.getByRole('menuitem', { name: 'Eliminar ticket' })).toBeInTheDocument();
  });

  it('a settled ticket cannot be edited', async () => {
    const user = userEvent.setup();
    render(<TicketDetailActionsMenu {...props} paid={props.total} />);

    await user.click(screen.getByRole('button', { name: 'Más acciones del ticket' }));
    expect(screen.queryByRole('menuitem', { name: 'Editar servicios' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Eliminar ticket' })).toBeInTheDocument();
  });

  it('Eliminar ticket names the client, total and payments, and makes no papelera promise', async () => {
    const user = userEvent.setup();
    mockDeleteTicket.mockResolvedValue({ success: true });
    render(<TicketDetailActionsMenu {...props} />);

    await user.click(screen.getByRole('button', { name: 'Más acciones del ticket' }));
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar ticket' }));

    const sheet = await screen.findByRole('dialog', { name: '¿Eliminar el ticket #1123?' });
    expect(sheet).toHaveTextContent('Corporativo Torres');
    expect(sheet).toHaveTextContent('$2,946,630.00');
    expect(sheet).toHaveTextContent('Tiene 1 pago registrado por $1,767,978.00');
    expect(sheet).toHaveTextContent('solo soporte puede restaurarlo');
    expect(sheet).not.toHaveTextContent(/papelera/i);

    await user.click(screen.getByRole('button', { name: 'Eliminar ticket' }));
    expect(mockDeleteTicket).toHaveBeenCalledWith(1123, 1);
    expect(mockPush).toHaveBeenCalledWith('/tickets');
  });

  it('Conservar closes the sheet without deleting', async () => {
    const user = userEvent.setup();
    render(<TicketDetailActionsMenu {...props} />);

    await user.click(screen.getByRole('button', { name: 'Más acciones del ticket' }));
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar ticket' }));
    await user.click(await screen.findByRole('button', { name: 'Conservar' }));

    expect(mockDeleteTicket).not.toHaveBeenCalled();
  });

  it('a viewer without write access gets no menu', () => {
    mockCan = () => false;
    render(<TicketDetailActionsMenu {...props} />);

    expect(screen.queryByRole('button', { name: 'Más acciones del ticket' })).toBeNull();
  });
});
