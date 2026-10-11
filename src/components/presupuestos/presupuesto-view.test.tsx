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
const mockDuplicate = jest.fn();
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
  duplicatePresupuesto: (...args: unknown[]) => mockDuplicate(...args),
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
    expect(screen.getByTestId('review-total')).toHaveTextContent('$2,950.00');
    // The listo uses the same compact Resumen as the ticket listo (ZIG-I13-3).
    expect(screen.getByTestId('review-summary')).toBeTruthy();
    expect(screen.queryByTestId('presupuesto-summary')).toBeNull();
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
    const dialog = await screen.findByRole('dialog');
    expect(mockConvert).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Convertir a ticket' }));

    await waitFor(() => expect(mockConvert).toHaveBeenCalledWith(400, 10));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/tickets/401'));
  });

  it('cancels behind a confirmation and refreshes', async () => {
    const user = userEvent.setup();
    mockCancel.mockResolvedValue({ success: true, data: {} });
    renderView();

    await user.click(screen.getAllByRole('button', { name: 'Cancelar presupuesto' })[0]);
    const dialog = await screen.findByRole('dialog');
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
    // Duplicar stays available for every status (ZIG-I13-5).
    expect(screen.getAllByRole('button', { name: 'Duplicar' }).length).toBeGreaterThan(0);
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

  it('review folds the materials behind Ver los N servicios y M materiales (ZIG-I13-3)', async () => {
    const user = userEvent.setup();
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

    expect(screen.queryByText(/Gas R410A/)).toBeNull();
    // 2100 + 570 + 1100
    expect(screen.getAllByText('$3,770.00').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Ver los 1 servicio y 2 materiales' }));
    expect(screen.getByText(/Gas R410A/)).toBeTruthy();
    expect(screen.getByText(/1.5 kg × \$380.00/)).toBeTruthy();
  });

  it('lists materials behind the Conceptos fold and the line amount includes them (ZIG-I10-4, ZIG-I13-5)', async () => {
    const user = userEvent.setup();
    renderView({
      variant: 'detail',
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

    expect(screen.getByTestId('presupuesto-counts')).toHaveTextContent('1 concepto · 2 materiales');
    expect(screen.queryByText(/Gas R410A/)).toBeNull();
    // 2100 + 570 + 1100
    expect(screen.getAllByText('$3,770.00').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Ver los 1 concepto y 2 materiales' }));
    expect(screen.getByText(/Gas R410A/)).toBeTruthy();
    expect(screen.getByText(/1.5 kg × \$380.00/)).toBeTruthy();
    expect(screen.getByText('$570.00')).toBeTruthy();
  });

  describe('detail redesign (ZIG-I13-5)', () => {
    it('shows the total, counts and the vigencia; the accept card has Convertir a ticket', () => {
      renderView({ expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString() });

      expect(screen.getByTestId('review-total')).toHaveTextContent('$2,950.00');
      expect(screen.getByTestId('presupuesto-counts')).toHaveTextContent('2 conceptos');
      expect(screen.getByTestId('presupuesto-expires')).toHaveTextContent(/Vence el .* · quedan 30 días/);
      const accept = screen.getByTestId('presupuesto-accept');
      expect(within(accept).getByRole('heading', { name: '¿Lo aceptó el cliente?' })).toBeTruthy();
      expect(within(accept).getByRole('button', { name: 'Convertir a ticket' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Plaza Comercial Aurora' })).toBeTruthy();
    });

    it('says Vencido past the date and Sin vencimiento without one', () => {
      const { unmount } = renderView({ status: 'vencido', expiresAt: '2026-10-01T12:00:00.000Z' });
      expect(screen.getByTestId('presupuesto-expires')).toHaveTextContent('Venció el 1 oct');
      expect(screen.getByTestId('presupuesto-status')).toHaveTextContent('Vencido');
      unmount();

      renderView({ expiresAt: null });
      expect(screen.getByTestId('presupuesto-expires')).toHaveTextContent('Sin vencimiento');
    });

    it('has Editar, Duplicar and Cancelar, and no accept card once converted or cancelled', () => {
      renderView({ editHref: '/presupuestos/400/edit' });
      const row = screen.getByTestId('presupuesto-actions');
      expect(within(row).getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/presupuestos/400/edit');
      expect(within(row).getByRole('button', { name: 'Duplicar' })).toBeTruthy();
      expect(within(row).getByRole('button', { name: 'Cancelar presupuesto' })).toBeTruthy();
    });

    it('does not offer the accept card on a converted quote', () => {
      renderView({ status: 'convertido', convertedToTicketId: '401' });
      expect(screen.queryByTestId('presupuesto-accept')).toBeNull();
    });

    it('folds long Condiciones behind Ver todas', async () => {
      const user = userEvent.setup();
      renderView({ workNotes: `${'Entrega en 6 a 8 semanas. '.repeat(20)}` });

      const notes = screen.getByTestId('presupuesto-notes');
      expect(notes.className).toContain('line-clamp-3');
      await user.click(screen.getByRole('button', { name: 'Ver todas' }));
      expect(notes.className).not.toContain('line-clamp-3');
      expect(screen.getByRole('button', { name: 'Ver menos' })).toBeTruthy();
    });

    it('shows short Condiciones in full with no toggle, and none when there are no notes', () => {
      const { unmount } = renderView({ workNotes: '60% de anticipo' });
      expect(screen.getByText('60% de anticipo')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Ver todas' })).toBeNull();
      unmount();

      renderView({ workNotes: null });
      expect(screen.queryByRole('heading', { name: 'Condiciones' })).toBeNull();
    });

    it('Duplicar writes a draft for the composer and opens it', async () => {
      const user = userEvent.setup();
      window.localStorage.clear();
      mockDuplicate.mockResolvedValue({
        success: true,
        data: {
          client: { id: 5, label: 'Plaza Comercial Aurora · 9981000001' },
          ticketDate: '2026-10-10T15:00:00.000Z',
          expiresAt: '2026-10-25T15:00:00.000Z',
          notes: 'Incluye material',
          lines: [
            { key: 'line-1', kind: 'custom', service_id: null, service_name: 'Cambio de capacitor', quantity: 1, price: 850 },
          ],
        },
      });
      renderView({ status: 'cancelado' });

      await user.click(screen.getAllByRole('button', { name: 'Duplicar' })[0]);

      await waitFor(() => expect(mockDuplicate).toHaveBeenCalledWith(400, 10));
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/presupuestos/create'));
      const stored = JSON.parse(
        window.localStorage.getItem('zigzag:presupuesto-composer-draft:v1:10') ?? 'null',
      );
      expect(stored).toMatchObject({
        client_id: 5,
        work_notes: 'Incluye material',
        lines: [{ service_name: 'Cambio de capacitor', price: 850 }],
      });
    });

    it('Duplicar names the problem and stays put when the server refuses', async () => {
      const user = userEvent.setup();
      mockDuplicate.mockResolvedValue({ success: false, error: 'No encontrado', errorType: 'validation' });
      renderView();

      await user.click(screen.getAllByRole('button', { name: 'Duplicar' })[0]);

      await waitFor(() => expect(mockDuplicate).toHaveBeenCalled());
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
