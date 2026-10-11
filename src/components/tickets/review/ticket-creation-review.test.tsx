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
const mockUpsertSchedule = jest.fn();
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
  upsertClientServiceSchedule: (...args: unknown[]) => mockUpsertSchedule(...args),
}));

jest.mock('@/lib/ticket-invoice-download', () => ({
  fetchTicketInvoiceFile: (...args: unknown[]) => mockFetchFile(...args),
  shareTicketInvoiceFile: (...args: unknown[]) => mockShareFile(...args),
  downloadTicketInvoiceFile: (...args: unknown[]) => mockDownloadFile(...args),
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
    mockUpsertSchedule.mockResolvedValue({ success: true });
    mockFetchFile.mockResolvedValue(pdfFile);
    mockShareFile.mockResolvedValue('shared');
  });

  it('shows the Resumen, the payment choice, reminders and PDF links, without detail-page noise (ZIG-I13-3)', async () => {
    renderReview();

    expect(
      screen.getByRole('heading', { name: 'Ticket #1201 guardado' }),
    ).toBeTruthy();
    expect(screen.getByText(/Cliente Demo · 8 de octubre 2026/)).toBeTruthy();
    const lines = screen.getByRole('list', { name: 'Servicios del ticket' });
    expect(within(lines).getByText(/Mantenimiento/)).toBeTruthy();
    expect(within(lines).getByText('$12,600.00')).toBeTruthy();
    expect(screen.getByTestId('review-total')).toHaveTextContent('$12,950.00');

    expect(screen.getByRole('heading', { name: '¿Cómo pagó el cliente?' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Todo' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Una parte' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Nada aún' })).toBeTruthy();
    expect(
      await screen.findByRole('heading', { name: 'Programar el próximo servicio' }),
    ).toBeTruthy();

    // The duplicated recibo summary and the PDF box are gone; the links stay.
    expect(screen.queryByTestId('recibo-summary')).toBeNull();
    expect(screen.queryByTestId('recibo-pdf-preview')).toBeNull();
    expect(screen.getByRole('link', { name: /Abrir PDF/ })).toHaveAttribute(
      'href',
      '/tickets/1201/recibo?from=listo',
    );
    expect(screen.getByRole('button', { name: /Descargar PDF/ })).toBeTruthy();

    for (const noise of [/Creado/, /Actualizado/, /Actividad/, /Más acciones/]) {
      expect(screen.queryByText(noise)).toBeNull();
    }
    expect(screen.queryByRole('heading', { name: 'Pagos' })).toBeNull();
  });

  it('collapses a long ticket behind Ver los N servicios y M materiales', async () => {
    const user = userEvent.setup();
    renderReview({
      lines: Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        serviceId: null,
        name: `Servicio ${index + 1}`,
        quantity: 1,
        price: 100,
        materials:
          index === 0
            ? [{ id: 1, name: 'Filtro', quantity: 2, unit: 'pza', price: 50, inline: false }]
            : undefined,
      })),
    });

    expect(screen.queryByText(/Servicio 4/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ver los 5 servicios y 1 material' }));
    expect(screen.getByText(/Servicio 5/)).toBeTruthy();
    expect(screen.getByText(/Filtro/)).toBeTruthy();
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

    await user.click(screen.getByRole('radio', { name: 'Nada aún' }));

    expect(screen.queryByTestId('review-pay-hint')).toBeNull();
    screen
      .getAllByRole('button', { name: /Finalizar y compartir/ })
      .forEach((button) => expect(button).toBeEnabled());
  });

  it('keeps Finalizar disabled for a partial payment with no amount', async () => {
    const user = userEvent.setup();
    renderReview();

    await user.click(screen.getByRole('radio', { name: 'Una parte' }));

    screen
      .getAllByRole('button', { name: /Finalizar y compartir/ })
      .forEach((button) => expect(button).toBeDisabled());
  });

  it('shows Saldo in the sticky bar once a partial amount is typed', async () => {
    const user = userEvent.setup();
    renderReview();

    expect(screen.getByTestId('review-sticky-amount')).toHaveTextContent('$12,950.00');
    await user.click(screen.getByRole('radio', { name: 'Una parte' }));
    await user.type(screen.getByLabelText('Cuánto pagó'), '5000');

    expect(screen.getByTestId('review-sticky-amount')).toHaveTextContent('$7,950.00');
    expect(screen.getByTestId('review-sticky-amount').previousElementSibling).toHaveTextContent(
      'Saldo pendiente',
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

  it('finishes with the chosen payment and the reminders ticked on this screen, then shares the PDF', async () => {
    const user = userEvent.setup();
    mockListSchedules.mockResolvedValue({
      success: true,
      data: [{ serviceId: 8, intervalValue: 3, intervalUnit: 'month' }],
    });
    renderReview();

    await user.click(screen.getByRole('radio', { name: 'Una parte' }));
    await user.type(screen.getByLabelText('Cuánto pagó'), '5000');

    // The service the client already has a reminder for comes checked.
    const recarga = await screen.findByRole('checkbox', { name: 'Recarga de gas' });
    const mantenimiento = screen.getByRole('checkbox', { name: 'Mantenimiento' });
    await waitFor(() => expect(recarga).toBeChecked());
    expect(mantenimiento).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Intervalo de Recarga de gas: en 3 meses/ })).toBeTruthy();
    await user.click(mantenimiento);

    await user.click(screen.getAllByRole('button', { name: /Finalizar y compartir/ })[0]);

    await waitFor(() =>
      expect(mockFinishTicket).toHaveBeenCalledWith(1201, 12950, 5000, 10),
    );
    // No Recordatorios dialog: what was ticked is saved, then the share sheet opens.
    await waitFor(() => expect(mockShareFile).toHaveBeenCalledWith(pdfFile, expect.objectContaining({
      title: 'Recibo ticket #1201',
    })));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockUpsertSchedule).toHaveBeenCalledTimes(2);
    expect(mockUpsertSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 5, serviceId: 7, intervalValue: 2, intervalUnit: 'month' }),
    );
    expect(mockUpsertSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 8, intervalValue: 3 }),
    );
    expect(mockUpsertSchedule.mock.invocationCallOrder[0]).toBeLessThan(
      mockShareFile.mock.invocationCallOrder[0],
    );
    expect(mockRefresh).toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'Ticket #1201 finalizado' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Compartir recibo/ }).length).toBeGreaterThan(0);
  });

  it('saves no reminder when none is ticked and has no schedules for typed-in lines', async () => {
    const user = userEvent.setup();
    renderReview();

    await user.click(screen.getByRole('radio', { name: 'Todo' }));
    await user.click(screen.getAllByRole('button', { name: /Finalizar y compartir/ })[0]);

    await waitFor(() => expect(mockShareFile).toHaveBeenCalled());
    expect(mockUpsertSchedule).not.toHaveBeenCalled();
  });

  it('offers no reminders when no line comes from the catalog', async () => {
    renderReview({
      lines: [{ id: 1, serviceId: null, name: 'Trabajo suelto', quantity: 1, price: 100 }],
    });

    expect(screen.queryByRole('heading', { name: 'Programar el próximo servicio' })).toBeNull();
    expect(mockListSchedules).not.toHaveBeenCalled();
  });

  it('finishes as Pendiente with nothing paid', async () => {
    const user = userEvent.setup();
    renderReview();

    await user.click(screen.getByRole('radio', { name: 'Nada aún' }));
    await user.click(screen.getAllByRole('button', { name: /Finalizar y compartir/ })[0]);

    await waitFor(() =>
      expect(mockFinishTicket).toHaveBeenCalledWith(1201, 12950, 0, 10),
    );
  });

  it('blocks a partial payment above the total', async () => {
    const user = userEvent.setup();
    renderReview();

    await user.click(screen.getByRole('radio', { name: 'Una parte' }));
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

    await user.click(screen.getByRole('radio', { name: 'Nada aún' }));
    await user.click(screen.getAllByRole('button', { name: /Finalizar y compartir/ })[0]);

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

  it('shows Pagado and Saldo and Compartir recibo as the single CTA once finished', () => {
    renderReview({ finished: true, paid: 5000 });

    expect(screen.queryByTestId('recibo-pdf-preview')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Programar el próximo servicio' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Finalizar y compartir/ })).toBeNull();
    const summary = screen.getByTestId('review-summary');
    expect(summary).toHaveTextContent('Pagado$5,000.00');
    expect(summary).toHaveTextContent('Saldo$7,950.00');
    expect(screen.getAllByRole('button', { name: /Compartir recibo/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Abrir PDF/ })).not.toHaveAttribute('target');
  });
});
