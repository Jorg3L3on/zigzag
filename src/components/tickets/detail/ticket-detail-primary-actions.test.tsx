/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { TicketDetailPrimaryActions } from '@/components/tickets/detail/ticket-detail-primary-actions';

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    can: () => true,
  }),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({
    selectedCompany: { id: 1, name: 'Demo' },
  }),
}));

jest.mock('@/components/pdf-download-button', () => ({
  PDFDownloadButton: ({ label }: { label?: string }) => (
    <button type="button">{label ?? 'PDF'}</button>
  ),
}));

jest.mock('@/components/tripled', () => ({
  TripledMobileStickyActionBar: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div data-testid="sticky">{children}</div>,
}));

describe('TicketDetailPrimaryActions', () => {
  it('shows Finalizar for unfinished tickets', () => {
    render(
      <TicketDetailPrimaryActions
        ticketId={12}
        clientId={3}
        finished={false}
        total={100}
        paid={0}
        downloadFileName="t.pdf"
        placement="desktop"
      />,
    );

    expect(
      screen.getByRole('link', { name: /finalizar ticket/i }),
    ).toHaveAttribute('href', '#finalizar');
    expect(screen.queryByText('Generar recibo')).not.toBeInTheDocument();
  });

  it('shows Registrar pago when finished with balance due', () => {
    render(
      <TicketDetailPrimaryActions
        ticketId={12}
        clientId={3}
        finished
        total={100}
        paid={40}
        downloadFileName="t.pdf"
        placement="desktop"
      />,
    );

    expect(
      screen.getByRole('link', { name: /registrar pago en cobranza/i }),
    ).toHaveAttribute('href', '#cobranza');
  });

  it('shows Generar recibo when saldado', () => {
    render(
      <TicketDetailPrimaryActions
        ticketId={12}
        clientId={3}
        finished
        total={100}
        paid={100}
        downloadFileName="t.pdf"
        placement="desktop"
      />,
    );

    expect(screen.getByText('Generar recibo')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /registrar pago/i }),
    ).not.toBeInTheDocument();
  });

  it('shows collect for finished pending ($0 paid)', () => {
    render(
      <TicketDetailPrimaryActions
        ticketId={12}
        clientId={null}
        finished
        total={80}
        paid={0}
        downloadFileName="t.pdf"
        placement="desktop"
      />,
    );

    expect(
      screen.getByRole('link', { name: /registrar pago en cobranza/i }),
    ).toBeInTheDocument();
  });
});
