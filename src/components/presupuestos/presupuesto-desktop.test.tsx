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

describe('Presupuesto desktop (ZIG-I28-5, ZIG-I29-1)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Element.prototype.scrollIntoView = jest.fn();
    // Only Date is fake: the chip and the bar count days from "today".
    jest.useFakeTimers({
      now: new Date('2026-10-22T17:00:00.000Z'),
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'performance',
        'hrtime',
      ],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
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

    // Two columns only when the page itself is wide enough, sidebar or not (ZIG-I29).
    expect(screen.getByTestId('presupuesto-desktop')).toHaveClass('@container');
    expect(screen.getByTestId('presupuesto-desktop-grid')).toHaveClass(
      '@min-[60rem]:grid-cols-[minmax(0,1fr)_300px]',
    );
    expect(screen.getByTestId('presupuesto-desktop-rail')).toHaveClass(
      '@min-[60rem]:sticky',
      '@min-[60rem]:top-20',
    );

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

  it('puts Convertir a ticket, WhatsApp, PDF and Editar in the header, and Cancelar in the menu', async () => {
    mockDesktopWidth(true);
    const user = userEvent.setup();
    const { onShare, onDownload, onConvert, onCancel, onDuplicate } = renderLayout();

    const actions = screen.getByTestId('presupuesto-desktop-actions');
    await user.click(within(actions).getByRole('button', { name: 'Convertir a ticket' }));
    // Desktop shares by WhatsApp with the quote text, never the system sheet.
    const whatsApp = within(actions).getByRole('link', { name: 'WhatsApp' });
    expect(decodeURIComponent(whatsApp.getAttribute('href') ?? '')).toMatch(
      /^https:\/\/wa\.me\/\d+\?text=.*presupuesto P-0003/,
    );
    expect(within(actions).queryByRole('button', { name: 'Compartir presupuesto' })).toBeNull();
    const pdf = within(actions).getByRole('button', { name: 'Descargar PDF' });
    expect(pdf).toHaveTextContent('PDF');
    await user.click(pdf);
    expect(within(actions).getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      '/presupuestos/400/edit',
    );

    const card = screen.getByTestId('presupuesto-vigencia-card');
    expect(within(card).queryByRole('button', { name: /Cancelar/ })).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'Convertir a ticket' }));

    expect(onConvert).toHaveBeenCalledTimes(2);
    expect(onShare).not.toHaveBeenCalled();
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

  it('shows the validity chip, the meta line, the bar and Recordar por WhatsApp while open', () => {
    mockDesktopWidth(true);
    renderLayout({
      ticketDate: '2026-10-10T12:00:00.000Z',
      expiresAt: '2026-10-25T12:00:00.000Z',
      authorName: 'Jorge Climas',
    });

    expect(screen.getByTestId('presupuesto-vigencia-chip')).toHaveTextContent('Vence en 3 días');
    expect(screen.getByTestId('presupuesto-vigencia-chip')).toHaveAttribute('data-tone', 'soon');
    expect(screen.getByTestId('presupuesto-meta')).toHaveTextContent(
      /^Emitido el .+ · Jorge Climas · 2 conceptos · 2 materiales$/,
    );

    const card = screen.getByTestId('presupuesto-vigencia-card');
    expect(within(card).getByTestId('presupuesto-desktop-expires')).toHaveTextContent(
      'Vence el 25 de octubre · quedan 3 días',
    );
    expect(within(card).getByTestId('presupuesto-vigencia-bar')).toHaveAttribute(
      'aria-label',
      '80% de la vigencia transcurrida',
    );
    expect(within(card).getByText('Vigencia de 15 días')).toBeTruthy();
    expect(within(card).getByText('¿Lo aceptó el cliente?')).toBeTruthy();
    const remind = within(card).getByRole('link', { name: 'Recordar por WhatsApp' });
    const text = decodeURIComponent(remind.getAttribute('href') ?? '');
    expect(text).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(text).toContain('Te recordamos el presupuesto P-0003');
    expect(text).toContain('Es válido hasta el 25 de octubre de 2026');
  });

  it('keeps Convertir and Editar on an expired presupuesto and says how long ago it expired', () => {
    mockDesktopWidth(true);
    renderLayout({
      status: 'vencido',
      ticketDate: '2026-10-01T12:00:00.000Z',
      expiresAt: '2026-10-19T12:00:00.000Z',
    });

    const chip = screen.getByTestId('presupuesto-vigencia-chip');
    expect(chip).toHaveTextContent('Venció hace 3 días');
    expect(chip).toHaveClass('text-red-700');
    expect(screen.getByTestId('presupuesto-status')).toHaveTextContent('Vencido');
    const card = screen.getByTestId('presupuesto-vigencia-card');
    expect(within(card).getByTestId('presupuesto-desktop-expires')).toHaveTextContent(
      'Venció el 19 de octubre · hace 3 días',
    );
    expect(within(card).getByTestId('presupuesto-desktop-expires')).toHaveClass('text-red-700');
    const text = decodeURIComponent(
      within(card).getByRole('link', { name: 'Recordar por WhatsApp' }).getAttribute('href') ?? '',
    );
    expect(text).toContain('Venció el 19 de octubre de 2026; si te sigue interesando, lo actualizamos.');
    const actions = screen.getByTestId('presupuesto-desktop-actions');
    expect(within(actions).getByRole('button', { name: 'Convertir a ticket' })).toBeTruthy();
    expect(within(actions).getByRole('link', { name: 'Editar' })).toBeTruthy();
  });

  it('opens Extender vigencia from the Vigencia card and from the header menu', async () => {
    mockDesktopWidth(true);
    const user = userEvent.setup();
    const onExtend = jest.fn();
    renderLayout({ status: 'vencido', expiresAt: '2026-10-19T12:00:00.000Z', onExtend });

    const card = screen.getByTestId('presupuesto-vigencia-card');
    await user.click(within(card).getByRole('button', { name: 'Extender vigencia' }));
    await user.click(screen.getByRole('button', { name: 'Más acciones del presupuesto' }));
    await user.click(screen.getByRole('menuitem', { name: 'Extender vigencia' }));
    expect(onExtend).toHaveBeenCalledTimes(2);
  });

  it('asks for a date when the presupuesto has no expiry', () => {
    mockDesktopWidth(true);
    renderLayout({ expiresAt: null });

    expect(screen.getByTestId('presupuesto-vigencia-chip')).toHaveTextContent('Sin vencimiento');
    const card = screen.getByTestId('presupuesto-vigencia-card');
    expect(within(card).queryByTestId('presupuesto-vigencia-bar')).toBeNull();
    expect(within(card).getByRole('link', { name: 'ponle fecha' })).toHaveAttribute(
      'href',
      '/presupuestos/400/edit',
    );
  });

  it('prints the whole conditions with Editar on desktop', () => {
    mockDesktopWidth(true);
    const long = Array.from({ length: 6 }, (_, i) => `Condición ${i + 1} con bastante texto para doblar.`).join('\n');
    renderLayout({ workNotes: long });

    expect(screen.getByTestId('presupuesto-notes')).not.toHaveClass('line-clamp-3');
    expect(screen.queryByRole('button', { name: 'Ver todas' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Editar condiciones' })).toHaveAttribute(
      'href',
      '/presupuestos/400/edit',
    );
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

  it('shows an accepted presupuesto in green with the card of its R ticket', async () => {
    mockDesktopWidth(true);
    const user = userEvent.setup();
    renderLayout({
      status: 'convertido',
      convertedToTicketId: '401',
      isMutable: false,
      editHref: null,
      convertedTicket: {
        id: '401',
        folio: 'R-0061',
        finished: false,
        total: 3770,
        paid: 0,
        serviceCount: 2,
        materialCount: 2,
      },
      activity: [
        {
          id: 9,
          eventType: 'presupuesto_converted',
          actorName: 'Jorge Climas',
          createdAt: new Date('2026-10-10T18:00:00.000Z'),
          payload: null,
        },
      ],
    });

    expect(screen.getByTestId('presupuesto-status')).toHaveTextContent('Aceptado');
    expect(screen.getByTestId('presupuesto-status')).toHaveClass('text-emerald-700');
    expect(screen.queryByTestId('presupuesto-vigencia-chip')).toBeNull();
    expect(screen.queryByTestId('presupuesto-vigencia-card')).toBeNull();

    const actions = screen.getByTestId('presupuesto-desktop-actions');
    expect(within(actions).getByRole('link', { name: 'Ver ticket R-0061' })).toHaveAttribute(
      'href',
      '/tickets/401',
    );
    expect(within(actions).getByRole('link', { name: 'WhatsApp' })).toBeTruthy();
    expect(within(actions).queryByRole('button', { name: 'Convertir a ticket' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull();

    const card = screen.getByTestId('presupuesto-accepted-card');
    expect(within(card).getByText(/^Aceptado el 10 de octubre$/)).toBeTruthy();
    expect(within(card).getByText('Jorge Climas · vencía el 8 nov')).toBeTruthy();
    const ticket = within(card).getByTestId('presupuesto-converted-ticket');
    expect(ticket).toHaveAttribute('href', '/tickets/401');
    expect(ticket).toHaveTextContent('R-0061');
    expect(within(ticket).getByTestId('ticket-status-pill')).toHaveTextContent('En proceso');
    expect(ticket).toHaveTextContent('2 servicios · 2 materiales');
    expect(within(ticket).getByTestId('presupuesto-converted-total')).toHaveTextContent('$3,770.00');

    await user.click(screen.getByRole('button', { name: 'Más acciones del presupuesto' }));
    expect(screen.queryByRole('menuitem', { name: 'Cancelar presupuesto' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Duplicar' })).toBeTruthy();
  });

  it('keeps a canceled presupuesto read-only with Duplicar as the primary action', async () => {
    mockDesktopWidth(true);
    const user = userEvent.setup();
    const { onDuplicate } = renderLayout({
      status: 'cancelado',
      isMutable: false,
      editHref: null,
      canceledAt: '2026-10-11T17:00:00.000Z',
      activity: [],
    });

    const actions = screen.getByTestId('presupuesto-desktop-actions');
    const primary = within(actions).getByRole('button', { name: 'Duplicar' });
    expect(primary).not.toHaveClass('border');
    await user.click(primary);
    expect(within(actions).queryByRole('link', { name: 'WhatsApp' })).toBeNull();
    expect(within(actions).queryByRole('button', { name: 'Convertir a ticket' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull();

    const card = screen.getByTestId('presupuesto-canceled-card');
    expect(within(card).getByText(/^Cancelado el 11 de octubre$/)).toBeTruthy();
    expect(within(card).getByText(/Solo lectura/)).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'Duplicar presupuesto' }));
    expect(onDuplicate).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Más acciones del presupuesto' }));
    expect(screen.queryByRole('menuitem', { name: 'Cancelar presupuesto' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Duplicar' })).toBeNull();
  });

  it('counts the client tickets and presupuestos on the Cliente card', () => {
    mockDesktopWidth(true);
    renderLayout({ clientTicketCount: 2, clientPresupuestoCount: 1 });
    expect(screen.getByTestId('presupuesto-client-documents')).toHaveTextContent(
      '2 tickets · 1 presupuesto',
    );
    expect(screen.getByTestId('presupuesto-client-address')).toHaveTextContent('Sin dirección · Agregar');
  });

  it('opens the rest of the activity from Ver todo', async () => {
    mockDesktopWidth(true);
    const user = userEvent.setup();
    renderLayout();

    const card = screen.getByTestId('presupuesto-activity-card');
    const timeline = document.getElementById('presupuesto-timeline-body');
    expect(within(card).getByText('Ana creó el presupuesto')).toBeTruthy();
    expect(within(card).getByText('Mara canceló el presupuesto')).toBeTruthy();
    expect(within(card).getByText('Paz lo duplicó')).toBeTruthy();
    expect(within(card).queryByText('Zoe lo convirtió en ticket')).toBeNull();
    expect(timeline).toHaveAttribute('hidden');

    await user.click(within(card).getByRole('button', { name: 'Ver todo' }));
    expect(timeline).not.toHaveAttribute('hidden');
    expect(within(timeline as HTMLElement).getByText('Zoe lo convirtió en ticket')).toBeTruthy();
  });
});
