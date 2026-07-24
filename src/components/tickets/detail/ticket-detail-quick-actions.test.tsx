/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { TicketDetailQuickActions } from '@/components/tickets/detail/ticket-detail-quick-actions';

const mockCan = jest.fn();

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: mockCan }),
}));

jest.mock('@/components/pdf-download-button', () => ({
  PDFDownloadButton: ({ label }: { label?: string }) => (
    <button type="button">{label ?? 'PDF'}</button>
  ),
}));

describe('TicketDetailQuickActions', () => {
  beforeEach(() => {
    mockCan.mockReset();
    mockCan.mockReturnValue(true);
  });

  it('shows edit and services for an open ticket with write access', () => {
    render(
      <TicketDetailQuickActions
        ticketId={12}
        finished={false}
        total={100}
        paid={0}
        downloadFileName="ticket.pdf"
      />,
    );

    expect(screen.getByRole('link', { name: /editar ticket/i })).toHaveAttribute(
      'href',
      '/tickets/12/edit',
    );
    expect(
      screen.getByRole('link', { name: /administrar servicios/i }),
    ).toHaveAttribute('href', '/tickets/12/services');
    expect(
      screen.getByRole('link', { name: /registrar pago/i }),
    ).toHaveAttribute('href', '/tickets/12/edit');
    expect(screen.queryByText('Generar factura')).not.toBeInTheDocument();
  });

  it('shows cobranza anchor and invoice when finished with partial payment', () => {
    render(
      <TicketDetailQuickActions
        ticketId={12}
        finished
        total={100}
        paid={40}
        downloadFileName="ticket.pdf"
      />,
    );

    expect(screen.queryByRole('link', { name: /editar ticket/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /registrar pago/i }),
    ).toHaveAttribute('href', '#cobranza');
    expect(screen.getByText('Generar factura')).toBeInTheDocument();
  });

  it('hides actions when the user lacks permissions', () => {
    mockCan.mockReturnValue(false);
    const { container } = render(
      <TicketDetailQuickActions
        ticketId={12}
        finished={false}
        total={100}
        paid={0}
        downloadFileName="ticket.pdf"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
