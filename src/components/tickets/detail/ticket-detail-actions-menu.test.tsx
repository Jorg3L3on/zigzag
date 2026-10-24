/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TicketDetailActionsMenu } from '@/components/tickets/detail/ticket-detail-actions-menu';

const mockPush = jest.fn();
const mockDeleteTicket = jest.fn();
let mockCan = () => true;

jest.mock('@/hooks/use-company-payment-info', () => ({
  useCompanyPaymentInfo: () => null,
}));

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
const mockDuplicate = jest.fn();
jest.mock('@/actions/tickets', () => ({
  deleteTicket: (...args: unknown[]) => mockDeleteTicket(...args),
  duplicateTicket: (...args: unknown[]) => mockDuplicate(...args),
}));
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
      '/tickets/1123/edit',
    );
    expect(screen.getByRole('menuitem', { name: 'Descargar PDF' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicar ticket' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Eliminar ticket' })).toBeInTheDocument();
  });

  it('brings Editar out of ⋯ from 1024px; Duplicar, Descargar and Eliminar stay (ZIG-I24-3)', async () => {
    const user = userEvent.setup();
    render(<TicketDetailActionsMenu {...props} inlineFromLg />);

    const edit = screen.getByRole('link', { name: 'Editar servicios' });
    expect(edit).toHaveAttribute('href', '/tickets/1123/edit');
    expect(edit).toHaveTextContent('Editar');
    expect(screen.getByTestId('ticket-detail-inline-actions')).toHaveClass('hidden', 'lg:inline-flex');
    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull();

    // The menu keeps Editar servicios for md, hidden from lg; the rest always.
    await user.click(screen.getByRole('button', { name: 'Más acciones del ticket' }));
    expect(screen.getByRole('menuitem', { name: 'Editar servicios' })).toHaveClass('lg:hidden');
    expect(screen.getByRole('menuitem', { name: 'Duplicar ticket' })).not.toHaveClass('lg:hidden');
    expect(screen.getByRole('menuitem', { name: 'Descargar PDF' })).not.toHaveClass('lg:hidden');
    expect(screen.getByRole('menuitem', { name: 'Eliminar ticket' })).not.toHaveClass('lg:hidden');
  });

  it('Duplicar ticket writes a draft for the composer and opens it', async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    mockDuplicate.mockResolvedValue({
      success: true,
      data: {
        client: { id: 5, label: 'Corporativo Torres · 9981234567' },
        ticketDate: '2026-10-10T15:00:00.000Z',
        notes: 'Garantía',
        lines: [
          { key: 'line-1', kind: 'custom', service_id: null, service_name: 'Soporte', quantity: 1, price: 150 },
        ],
      },
    });
    render(<TicketDetailActionsMenu {...props} />);

    await user.click(screen.getByRole('button', { name: 'Más acciones del ticket' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicar ticket' }));

    await waitFor(() => expect(mockDuplicate).toHaveBeenCalledWith(1123, 1));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/tickets/create'));
    const stored = JSON.parse(window.localStorage.getItem('zigzag:ticket-composer-draft:v1:1') ?? 'null');
    expect(stored).toMatchObject({ client_id: 5, work_notes: 'Garantía', lines: [{ service_name: 'Soporte' }] });
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
