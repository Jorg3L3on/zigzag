/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PresupuestoDetailLayout } from '@/components/presupuestos/presupuesto-detail-layout';
import type { PresupuestoActivityEntry } from '@/components/presupuestos/presupuesto-desktop';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const originalMatchMedia = window.matchMedia;

const mockDesktopWidth = (desktop: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: desktop && query === '(min-width: 1024px)',
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
};

const lines = [
  {
    id: 1,
    serviceId: null,
    name: 'Revisión de fuga',
    description: 'Con nitrógeno',
    quantity: 1,
    price: 600,
  },
  {
    id: 2,
    serviceId: 11,
    name: 'Mantenimiento de cuarto frío',
    quantity: 1,
    price: 2100,
    materials: [
      { id: 7, name: 'Gas R410A', quantity: 1.5, unit: 'kg', price: 380, inline: false },
      { id: 8, name: 'Soporte', quantity: 2, unit: 'pza', price: 550, inline: true },
    ],
  },
];

const activity = (actorName: string, eventType: string, id: number): PresupuestoActivityEntry => ({
  id,
  eventType,
  actorName,
  createdAt: new Date('2026-10-09T15:00:00.000Z'),
  payload: null,
});

const renderLayout = (
  overrides: Partial<React.ComponentProps<typeof PresupuestoDetailLayout>> = {},
) => {
  const onShare = jest.fn();
  const onDownload = jest.fn();
  const onConvert = jest.fn();
  const onCancel = jest.fn();
  const onDuplicate = jest.fn();
  render(
    <PresupuestoDetailLayout
      presupuestoId="400"
      folio="P-0003"
      clientId={5}
      clientName="Plaza Comercial Aurora"
      clientTel="9981000001"
      clientEmail="aurora@plaza.test"
      ticketDate="2026-10-09T12:00:00.000Z"
      expiresAt="2026-11-08T12:00:00.000Z"
      workNotes="Incluye material"
      total={3770}
      lines={lines}
      status="abierto"
      convertedToTicketId={null}
      editHref="/presupuestos/400/edit"
      canWrite
      canInvoice
      isMutable
      mutating={false}
      sharing={false}
      downloading={false}
      duplicating={false}
      onShare={onShare}
      onDownload={onDownload}
      onConvert={onConvert}
      onCancel={onCancel}
      onDuplicate={onDuplicate}
      companyName="ClimaTotal"
      activity={[
        activity('Ana', 'created', 1),
        activity('Luis', 'updated', 2),
        activity('Mara', 'presupuesto_canceled', 3),
        activity('Paz', 'presupuesto_duplicated', 4),
        activity('Zoe', 'presupuesto_converted', 5),
      ]}
      {...overrides}
    />,
  );
  return { onShare, onDownload, onConvert, onCancel, onDuplicate };
};

describe('Presupuesto desktop (ZIG-I28-5)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('keeps the phone layout when the viewport is below 1024px', () => {
    mockDesktopWidth(false);
    renderLayout();

    expect(screen.queryByTestId('presupuesto-desktop')).toBeNull();
    expect(screen.getByTestId('presupuesto-accept')).toBeTruthy();
    expect(screen.queryByText('P. unitario')).toBeNull();
    expect(screen.queryByTestId('presupuesto-desktop-rail')).toBeNull();
  });

  it('renders the receipt rows, quote totals and the sticky rail from 1024px', () => {
    mockDesktopWidth(true);
    renderLayout();

    expect(screen.getByTestId('presupuesto-desktop')).toBeTruthy();
    expect(screen.queryByTestId('presupuesto-accept')).toBeNull();
    expect(screen.queryByRole('button', { name: '¿Lo aceptó el cliente?' })).toBeNull();

    expect(screen.getByTestId('presupuesto-desktop-grid')).toHaveClass(
      'lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]',
    );
    expect(screen.getByTestId('presupuesto-desktop-rail')).toHaveClass('lg:sticky', 'lg:top-20');

    expect(screen.getByText('Presupuesto P-0003')).toBeTruthy();
    expect(screen.getByTestId('presupuesto-status')).toHaveTextContent('Abierto');
    expect(screen.getByText('Concepto')).toBeTruthy();
    expect(screen.getByText('Cant.')).toBeTruthy();
    expect(screen.getByText('P. unitario')).toBeTruthy();
    expect(screen.getByText('Importe')).toBeTruthy();
    expect(screen.getAllByTestId('document-line-row')[0]).toHaveAttribute('data-layout', 'receipt');
    expect(screen.getByText('Con nitrógeno')).toBeTruthy();
    expect(screen.getByText('Gas R410A')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Detallado' })).toHaveAttribute('aria-pressed', 'true');

    const totals = screen.getByTestId('presupuesto-desktop-totals');
    expect(within(totals).getByText('Servicios')).toBeTruthy();
    expect(within(totals).getByText('Materiales')).toBeTruthy();
    expect(within(totals).getByText('Total del presupuesto')).toBeTruthy();
    expect(within(totals).getByText('$2,700.00')).toBeTruthy();
    expect(within(totals).getByText('$1,670.00')).toBeTruthy();
    expect(within(totals).getByText('$3,770.00')).toBeTruthy();
    expect(within(totals).queryByText('Pagado')).toBeNull();
    expect(within(totals).queryByText(/Saldo/)).toBeNull();
    expect(screen.getByTestId('presupuesto-notes')).toHaveTextContent('Incluye material');
  });

  it('puts Convertir, Compartir, PDF and Editar in the header, and Cancelar in the menu', async () => {
    mockDesktopWidth(true);
    const user = userEvent.setup();
    const { onShare, onDownload, onConvert, onCancel, onDuplicate } = renderLayout();

    const actions = screen.getByTestId('presupuesto-desktop-actions');
    await user.click(within(actions).getByRole('button', { name: 'Convertir' }));
    await user.click(within(actions).getByRole('button', { name: 'Compartir presupuesto' }));
    const pdf = within(actions).getByRole('button', { name: 'Descargar PDF' });
    expect(pdf).toHaveTextContent('PDF');
    await user.click(pdf);
    expect(within(actions).getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      '/presupuestos/400/edit',
    );

    const estado = screen.getByTestId('presupuesto-estado-card');
    expect(within(estado).queryByRole('button', { name: /Cancelar/ })).toBeNull();
    expect(within(estado).getByTestId('presupuesto-desktop-expires')).toHaveTextContent(/Vence el/);
    await user.click(within(estado).getByRole('button', { name: 'Convertir en ticket' }));

    expect(onConvert).toHaveBeenCalledTimes(2);
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledTimes(1);

    expect(screen.queryByRole('button', { name: 'Cancelar presupuesto' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Más acciones del presupuesto' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancelar presupuesto' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Más acciones del presupuesto' }));
    expect(screen.getByRole('menuitem', { name: 'Abrir PDF' })).toHaveAttribute(
      'href',
      '/presupuestos/400/pdf',
    );
    await user.click(screen.getByRole('menuitem', { name: 'Duplicar' }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href') ?? '');
    expect(hrefs.some((href) => href.startsWith('tel:'))).toBe(false);
  });

  it('shows the client as text plus a WhatsApp quote link, never a tel link', () => {
    mockDesktopWidth(true);
    renderLayout();

    const client = screen.getByTestId('presupuesto-client-card');
    expect(within(client).getByText('PC')).toBeTruthy();
    expect(within(client).getByRole('link', { name: 'Plaza Comercial Aurora' })).toHaveAttribute(
      'href',
      '/clients/5',
    );
    const phone = within(client).getByTestId('presupuesto-client-phone');
    expect(phone.tagName).toBe('P');
    expect(phone).toHaveTextContent('9981000001');
    expect(within(client).getByTestId('presupuesto-client-address')).toHaveTextContent('Sin dirección');
    expect(within(client).getByTestId('presupuesto-client-email')).toHaveTextContent('aurora@plaza.test');
    expect(within(client).getByRole('link', { name: 'Ver cliente' })).toHaveAttribute('href', '/clients/5');

    const whatsApp = within(client).getByRole('link', { name: 'WhatsApp' });
    const href = decodeURIComponent(whatsApp.getAttribute('href') ?? '');
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(href).toContain('ClimaTotal');
    expect(href).toContain('presupuesto P-0003');
    expect(href).not.toMatch(/^tel:/);
  });

  it('prints the address when the client has one', () => {
    mockDesktopWidth(true);
    renderLayout({ clientAddress: 'Av. Reforma #100, Centro, Cancún' });
    expect(screen.getByTestId('presupuesto-client-address')).toHaveTextContent(
      'Av. Reforma #100, Centro, Cancún',
    );
  });

  it('links a converted presupuesto to its ticket from the Estado card', async () => {
    mockDesktopWidth(true);
    const user = userEvent.setup();
    renderLayout({ status: 'convertido', convertedToTicketId: '401', isMutable: false, editHref: null });

    const estado = screen.getByTestId('presupuesto-estado-card');
    expect(within(estado).getByTestId('presupuesto-converted-ticket')).toHaveAttribute(
      'href',
      '/tickets/401',
    );
    expect(within(estado).queryByRole('button', { name: 'Convertir en ticket' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Convertir' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Más acciones del presupuesto' }));
    expect(screen.queryByRole('menuitem', { name: 'Cancelar presupuesto' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Duplicar' })).toBeTruthy();
  });

  it('keeps a canceled presupuesto read-only and without Compartir', () => {
    mockDesktopWidth(true);
    renderLayout({ status: 'cancelado', isMutable: false, editHref: null, activity: [] });

    const estado = screen.getByTestId('presupuesto-estado-card');
    expect(within(estado).getByText(/Presupuesto cancelado/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Compartir presupuesto' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Convertir en ticket' })).toBeNull();
  });

  it('opens the rest of the activity from Ver todo', async () => {
    mockDesktopWidth(true);
    const user = userEvent.setup();
    renderLayout();

    const card = screen.getByTestId('presupuesto-activity-card');
    const timeline = document.getElementById('presupuesto-timeline-body');
    expect(within(card).getByText(/Ana creó el ticket/)).toBeTruthy();
    expect(within(card).getByText(/Paz: Presupuesto duplicado/)).toBeTruthy();
    expect(within(card).queryByText(/Zoe: Presupuesto convertido/)).toBeNull();
    expect(timeline).toHaveAttribute('hidden');

    await user.click(within(card).getByRole('button', { name: 'Ver todo' }));
    expect(timeline).not.toHaveAttribute('hidden');
    expect(screen.getByText(/Zoe: Presupuesto convertido/)).toBeTruthy();
  });
});
