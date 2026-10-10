/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PresupuestoView } from '@/components/presupuestos/presupuesto-view';
import { MobileChromeProvider } from '@/contexts/mobile-chrome-context';

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockConvert = jest.fn();
const mockCancel = jest.fn();
const mockFetchFile = jest.fn();
const mockShareFile = jest.fn();
const mockDownloadFile = jest.fn();
let mockGranted = ['tickets.write', 'tickets.invoice'];

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  usePathname: () => '/presupuestos/400',
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
  canWriteTickets: () => mockGranted.includes('tickets.write'),
  canDownloadTicketInvoice: () => mockGranted.includes('tickets.invoice'),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: () => true, loading: false, isSystem: false }),
}));

jest.mock('@/actions/presupuestos', () => ({
  convertPresupuestoToTicket: (...args: unknown[]) => mockConvert(...args),
  cancelPresupuesto: (...args: unknown[]) => mockCancel(...args),
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

const baseProps = {
  presupuestoId: '400',
  clientId: 5,
  clientName: 'Plaza Comercial Aurora',
  clientTel: '9981000001',
  ticketDate: '2026-10-09T12:00:00.000Z',
  expiresAt: '2026-10-24T12:00:00.000Z',
  workNotes: 'Incluye material',
  total: 2950,
  lines: [
    { id: 1, serviceId: null, name: 'Cambio de capacitor', quantity: 1, price: 850 },
    { id: 2, serviceId: 11, name: 'Mantenimiento de cuarto frío', quantity: 1, price: 2100 },
  ],
  status: 'abierto' as const,
  convertedToTicketId: null,
  downloadFileName: 'presupuesto_Plaza_2026-10-09_400.pdf',
};

const renderView = (props: Partial<React.ComponentProps<typeof PresupuestoView>> = {}) =>
  render(
    <MobileChromeProvider>
      <PresupuestoView variant="detail" {...baseProps} {...props} />
    </MobileChromeProvider>,
  );

describe('PresupuestoView (ZIG-I5-4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGranted = ['tickets.write', 'tickets.invoice'];
    mockFetchFile.mockResolvedValue(new File(['%PDF'], baseProps.downloadFileName));
  });

  it('review shows the saved header, lines, total, Vence and the PDF, and no ticket concepts', () => {
    renderView({ variant: 'review' });

    expect(
      screen.getByRole('heading', { name: 'Presupuesto #400 guardado' }),
    ).toBeTruthy();
    const lines = screen.getByRole('list', { name: 'Servicios del presupuesto' });
    expect(within(lines).getByText('Cambio de capacitor')).toBeTruthy();
    expect(within(lines).getByText('Nuevo')).toBeTruthy();
    expect(screen.getByTestId('presupuesto-expires')).toHaveTextContent('24 de octubre 2026');
    expect(screen.getAllByRole('button', { name: /Compartir/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Descargar PDF/ })).toBeTruthy();
    for (const forbidden of [/Pago/, /Finalizar/, /Recordatorios/, /Creado/, /Actividad/, /Saldo/, /Ticket #/]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
    // Convert / cancel live on the detail page, not the review.
    expect(screen.queryByRole('button', { name: 'Convertir a ticket' })).toBeNull();
  });

  it('Abrir PDF is an in-app link to the viewer page, never a new tab (ZIG-I9)', () => {
    renderView({ variant: 'detail' });

    const open = screen.getByRole('link', { name: /Abrir PDF/ });
    expect(open).toHaveAttribute('href', '/presupuestos/400/pdf');
    expect(open).not.toHaveAttribute('target');
  });

  it('detail shows the status chip and converts behind a confirmation', async () => {
    const user = userEvent.setup();
    mockConvert.mockResolvedValue({
      success: true,
      data: { ticketId: '401', presupuesto: {} },
    });
    renderView();

    expect(screen.getByTestId('presupuesto-status')).toHaveTextContent('Abierto');
    await user.click(screen.getByRole('button', { name: 'Convertir a ticket' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(mockConvert).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Convertir a ticket' }));

    await waitFor(() => expect(mockConvert).toHaveBeenCalledWith(400, 10));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/tickets/401'));
  });

  it('cancels behind a confirmation and refreshes', async () => {
    const user = userEvent.setup();
    mockCancel.mockResolvedValue({ success: true, data: {} });
    renderView();

    await user.click(screen.getByRole('button', { name: 'Cancelar presupuesto' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar presupuesto' }));

    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith(400, 10));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('a converted quote links to its ticket and offers no convert, cancel or edit', () => {
    renderView({ status: 'convertido', convertedToTicketId: '401', editHref: '/x' });

    expect(screen.getByText('Convertido en Ticket #401')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver ticket' })).toHaveAttribute(
      'href',
      '/tickets/401',
    );
    expect(screen.queryByRole('button', { name: 'Convertir a ticket' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar presupuesto' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Editar/ })).toBeNull();
  });

  it('a canceled quote is read-only and cannot be shared', () => {
    renderView({ status: 'cancelado' });

    expect(screen.getByText(/Presupuesto cancelado/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Compartir/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Convertir a ticket' })).toBeNull();
  });

  it('shares the PDF through the share sheet when supported', async () => {
    const user = userEvent.setup();
    mockShareFile.mockResolvedValue('shared');
    renderView();

    await user.click(screen.getAllByRole('button', { name: 'Compartir presupuesto' })[0]);

    await waitFor(() =>
      expect(mockShareFile).toHaveBeenCalledWith(expect.any(File), {
        title: 'Presupuesto #400',
        text: 'Presupuesto para Plaza Comercial Aurora',
      }),
    );
  });

  it('falls back to a WhatsApp text with total and Válido hasta', async () => {
    const user = userEvent.setup();
    mockShareFile.mockResolvedValue('unsupported');
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    renderView();

    await user.click(screen.getAllByRole('button', { name: 'Compartir presupuesto' })[0]);

    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
    const href = decodeURIComponent(String(openSpy.mock.calls[0][0]));
    expect(href).toContain('wa.me/');
    expect(href).toContain('presupuesto #400');
    expect(href).toContain('por $2,950');
    expect(href).toContain('Válido hasta el 24 de octubre de 2026');
    expect(mockDownloadFile).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('without write permission the detail hides convert and cancel', () => {
    mockGranted = ['tickets.invoice'];
    renderView();

    expect(screen.queryByRole('button', { name: 'Convertir a ticket' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar presupuesto' })).toBeNull();
  });

  it('lists materials under their line and the line amount includes them (ZIG-I10-4)', () => {
    renderView({
      variant: 'review',
      total: 3770,
      lines: [
        {
          id: 1,
          serviceId: 11,
          name: 'Mantenimiento de cuarto frío',
          quantity: 1,
          price: 2100,
          materials: [
            { id: 7, name: 'Gas R410A', quantity: 1.5, unit: 'kg', price: 380, inline: false },
            { id: 8, name: 'Soporte', quantity: 2, unit: 'pza', price: 550, inline: true },
          ],
        },
      ],
    });

    const lines = screen.getByRole('list', { name: 'Servicios del presupuesto' });
    const materials = within(lines).getByRole('list', { name: 'Materiales' });
    expect(within(materials).getByText('Gas R410A')).toBeTruthy();
    expect(within(materials).getByText('1.5 kg × $380.00')).toBeTruthy();
    expect(within(materials).getByText('$570.00')).toBeTruthy();
    // Only the inline material gets the Nuevo chip.
    expect(within(materials).getAllByText('Nuevo')).toHaveLength(1);
    // 2100 + 570 + 1100
    expect(within(lines).getByText('$3,770.00')).toBeTruthy();
  });
});

