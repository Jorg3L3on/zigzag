/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TicketCreationReview } from '@/components/tickets/review/ticket-creation-review';
import { MobileChromeProvider } from '@/contexts/mobile-chrome-context';

const mockRefresh = jest.fn();
const mockFinishTicket = jest.fn();
const mockListSchedules = jest.fn();
const mockFetchFile = jest.fn();
const mockShareFile = jest.fn();
const mockDownloadFile = jest.fn();
let mockGranted = ['tickets.finish', 'tickets.invoice'];

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: jest.fn() }),
  usePathname: () => '/tickets/1201/listo',
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 10, name: 'ClimaTotal' } }),
}));

jest.mock('@/lib/tickets-rbac', () => ({
  canFinishTicket: () => mockGranted.includes('tickets.finish'),
  canDownloadTicketInvoice: () => mockGranted.includes('tickets.invoice'),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: () => true, loading: false, isSystem: false }),
}));

jest.mock('@/actions/tickets', () => ({
  finishTicket: (...args: unknown[]) => mockFinishTicket(...args),
}));

jest.mock('@/actions/client-service-schedules', () => ({
  listClientServiceSchedulesForClient: (...args: unknown[]) => mockListSchedules(...args),
  upsertClientServiceSchedule: jest.fn(async () => ({ success: true })),
}));

jest.mock('@/lib/ticket-invoice-download', () => ({
  fetchTicketInvoiceFile: (...args: unknown[]) => mockFetchFile(...args),
  shareTicketInvoiceFile: (...args: unknown[]) => mockShareFile(...args),
  downloadTicketInvoiceFile: (...args: unknown[]) => mockDownloadFile(...args),
}));

jest.mock('@/components/service-schedules/ticket-finish-schedules-dialog', () => ({
  TicketFinishSchedulesDialog: ({
    open,
    onSkip,
    confirmLabel,
  }: {
    open: boolean;
    onSkip: () => void;
    confirmLabel?: string;
  }) =>
    open ? (
      <div role="dialog" aria-label="Recordatorios de servicio">
        <button type="button" onClick={onSkip}>
          Omitir
        </button>
        <span data-testid="dialog-confirm-label">{confirmLabel}</span>
      </div>
    ) : null,
}));

jest.mock('@/components/tripled', () => {
  const actual = jest.requireActual('@/components/tripled');
  return {
    ...actual,
    TripledMobileAppBar: ({ title }: { title: string }) => <div>{title}</div>,
  };
});

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), message: jest.fn() },
}));

jest.mock('@/lib/vibrate-success', () => ({ vibrateSuccess: jest.fn() }));

const baseProps = {
  ticketId: '1201',
  clientId: 5,
  clientName: 'Cliente Demo',
  clientTel: '9613151559',
  ticketDate: '2026-10-08T12:00:00.000Z',
  total: 12950,
  paid: 0,
  finished: false,
  lines: [
    { id: 1, serviceId: 7, name: 'Mantenimiento', quantity: 3, price: 4200 },
    { id: 2, serviceId: 8, name: 'Recarga de gas', quantity: 1, price: 350 },
  ],
  downloadFileName: 'Cliente_Demo_1201.pdf',
};

const renderReview = (props: Partial<typeof baseProps> = {}) =>
  render(
    <MobileChromeProvider>
      <TicketCreationReview {...baseProps} {...props} />
    </MobileChromeProvider>,
  );

const pdfFile = new File(['pdf'], 'Cliente_Demo_1201.pdf', { type: 'application/pdf' });

describe('TicketCreationReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGranted = ['tickets.finish', 'tickets.invoice'];
    mockFinishTicket.mockResolvedValue({ success: true });
    mockListSchedules.mockResolvedValue({ success: true, data: [] });
    mockFetchFile.mockResolvedValue(pdfFile);
    mockShareFile.mockResolvedValue('shared');
  });

  it('shows client, date, lines, total, pago and recibo, without detail-page noise', () => {
    renderReview();

    expect(
      screen.getByRole('heading', { name: 'Ticket #1201 guardado' }),
    ).toBeTruthy();
    expect(screen.getByText(/Cliente Demo · 8 de octubre 2026/)).toBeTruthy();
    const lines = screen.getByRole('list', { name: 'Servicios del ticket' });
    expect(within(lines).getByText('3 × $4,200.00')).toBeTruthy();
    expect(screen.getByTestId('review-total')).toHaveTextContent('$12,950.00');
    expect(screen.getByRole('radio', { name: /Pagado completo/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('radio', { name: /Pago parcial/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Pendiente/ })).toBeTruthy();
    expect(screen.getByTestId('recibo-summary')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Descargar PDF/ })).toBeTruthy();

    for (const noise of [/Creado/, /Actualizado/, /Actividad/, /Más acciones/]) {
      expect(screen.queryByText(noise)).toBeNull();
    }
    expect(screen.queryByRole('heading', { name: 'Pagos' })).toBeNull();
  });

  it('starts with no payment chosen and Finalizar disabled until one is picked (ZIG-I12 Q2)', async () => {
    const user = userEvent.setup();
    renderReview();

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    }
    expect(screen.getByTestId('review-pay-hint')).toBeTruthy();
    screen
      .getAllByRole('button', { name: /Finalizar y compartir/ })
      .forEach((button) => expect(button).toBeDisabled());
    expect(mockFinishTicket).not.toHaveBeenCalled();

    await user.click(screen.getByRole('radio', { name: /Pendiente/ }));

    expect(screen.queryByTestId('review-pay-hint')).toBeNull();
    screen
      .getAllByRole('button', { name: /Finalizar y compartir/ })
      .forEach((button) => expect(button).toBeEnabled());
  });

  it('keeps Finalizar disabled for a partial payment with no amount', async () => {
    const user = userEvent.setup();
    renderReview();

    await user.click(screen.getByRole('radio', { name: /Pago parcial/ }));

    screen
      .getAllByRole('button', { name: /Finalizar y compartir/ })
      .forEach((button) => expect(button).toBeDisabled());
  });

  it('shows Saldo in the sticky bar once a partial amount is typed', async () => {
    const user = userEvent.setup();
    renderReview();

    expect(screen.getByTestId('review-sticky-amount')).toHaveTextContent('$12,950.00');
    await user.click(screen.getByRole('radio', { name: /Pago parcial/ }));
    await user.type(screen.getByLabelText('Cuánto pagó'), '5000');

    expect(screen.getByTestId('review-sticky-amount')).toHaveTextContent('$7,950.00');
    expect(screen.getByTestId('review-sticky-amount').previousElementSibling).toHaveTextContent(
      'Saldo',
    );
  });

  it('has exactly one primary action: Finalizar y compartir', () => {
    renderReview();

    const primaries = screen.getAllByRole('button', { name: /Finalizar y compartir/ });
    // Same CTA rendered for desktop and in the mobile sticky bar.
    expect(primaries.length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Finalizar$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Compartir recibo/ })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Guardar sin finalizar' }).length).toBeGreaterThan(0);
  });

  it('finishes with the chosen payment, shares the PDF file, then offers recordatorios', async () => {
    const user = userEvent.setup();
    renderReview();

    await user.click(screen.getByRole('radio', { name: /Pago parcial/ }));
    await user.type(screen.getByLabelText('Cuánto pagó'), '5000');
    expect(screen.getByTestId('recibo-summary')).toHaveTextContent('$5,000.00');

    await user.click(screen.getAllByRole('button', { name: /Finalizar y compartir/ })[0]);

    await waitFor(() =>
      expect(mockFinishTicket).toHaveBeenCalledWith(1201, 12950, 5000, 10),
    );
    // Recordatorios come first; the share sheet opens after the user answers.
    const dialog = await screen.findByRole('dialog', { name: 'Recordatorios de servicio' });
    expect(screen.getByTestId('dialog-confirm-label')).toHaveTextContent(
      'Guardar recordatorio',
    );
    expect(mockShareFile).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Omitir' }));

    await waitFor(() => expect(mockShareFile).toHaveBeenCalledWith(pdfFile, expect.objectContaining({
      title: 'Recibo ticket #1201',
    })));
    expect(mockRefresh).toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'Ticket #1201 finalizado' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Compartir recibo/ }).length).toBeGreaterThan(0);
  });

  it('finishes as Pendiente with nothing paid', async () => {
    const user = userEvent.setup();
    renderReview();

    await user.click(screen.getByRole('radio', { name: /Pendiente/ }));
    await user.click(screen.getAllByRole('button', { name: /Finalizar y compartir/ })[0]);

    await waitFor(() =>
      expect(mockFinishTicket).toHaveBeenCalledWith(1201, 12950, 0, 10),
    );
  });

  it('blocks a partial payment above the total', async () => {
    const user = userEvent.setup();
    renderReview();

    await user.click(screen.getByRole('radio', { name: /Pago parcial/ }));
    await user.type(screen.getByLabelText('Cuánto pagó'), '99999');

    expect(screen.getByRole('alert')).toHaveTextContent('No puede ser mayor que el total');
    screen
      .getAllByRole('button', { name: /Finalizar y compartir/ })
      .forEach((button) => expect(button).toBeDisabled());
  });

  it('falls back to WhatsApp when the browser cannot share files', async () => {
    const user = userEvent.setup();
    mockShareFile.mockResolvedValue('unsupported');
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    renderReview();

    await user.click(screen.getByRole('radio', { name: /Pendiente/ }));
    await user.click(screen.getAllByRole('button', { name: /Finalizar y compartir/ })[0]);
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Recordatorios de servicio' })).getByRole(
        'button',
        { name: 'Omitir' },
      ),
    );

    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(String(open.mock.calls[0][0])).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(mockDownloadFile).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('downloads the PDF from Descargar PDF', async () => {
    const user = userEvent.setup();
    renderReview({ finished: true, paid: 12950 });

    await user.click(screen.getByRole('button', { name: /Descargar PDF/ }));

    await waitFor(() => expect(mockDownloadFile).toHaveBeenCalledWith(pdfFile));
    expect(mockFetchFile).toHaveBeenCalledWith({
      ticketId: '1201',
      downloadFileName: 'Cliente_Demo_1201.pdf',
      companyId: 10,
    });
  });

  it('shows the PDF preview and Compartir recibo as the single CTA once finished', () => {
    Object.defineProperty(navigator, 'pdfViewerEnabled', {
      configurable: true,
      value: true,
    });
    renderReview({ finished: true, paid: 12950 });

    expect(screen.getByTestId('recibo-pdf-preview')).toHaveAttribute(
      'data',
      '/api/tickets/1201/invoice?disposition=inline&company_id=10',
    );
    expect(screen.queryByRole('radio', { name: /Pagado completo/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Finalizar y compartir/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Compartir recibo/ }).length).toBeGreaterThan(0);
  });

  it('shows only the summary where the browser cannot render PDFs inline', () => {
    Object.defineProperty(navigator, 'pdfViewerEnabled', {
      configurable: true,
      value: false,
    });
    renderReview({ finished: true, paid: 12950 });

    expect(screen.queryByTestId('recibo-pdf-preview')).toBeNull();
    expect(screen.getByTestId('recibo-summary')).toHaveTextContent('$12,950.00');
    const open = screen.getByRole('link', { name: /Abrir PDF/ });
    expect(open).toHaveAttribute('href', '/tickets/1201/recibo?from=listo');
    expect(open).not.toHaveAttribute('target');
  });
});
