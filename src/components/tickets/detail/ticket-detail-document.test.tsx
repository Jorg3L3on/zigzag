/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';

import { TicketDetailDocument } from '@/components/tickets/detail/ticket-detail-document';
import type { DocumentSummaryLine } from '@/components/documents/document-summary-rows';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * DocumentLineRow paints the receipt grid (description, unit price) only when
 * useIsDesktop sees `(min-width: 1024px)`. TicketDetailDocument itself does not
 * call that hook.
 */
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

const line: DocumentSummaryLine = {
  id: 1,
  name: 'Instalación mini-split',
  description: 'Equipo de 1 tonelada en recámara',
  serviceId: 4,
  quantity: 2,
  price: 4200,
  amount: 8700,
  materials: [
    { id: 1, name: 'Filtro de aire', quantity: 1, unit: 'pza', price: 150, amount: 150 },
    { id: 2, name: 'Tubo de cobre', quantity: 2, unit: 'm', price: 75, amount: 150 },
  ],
};

type DocumentProps = React.ComponentProps<typeof TicketDetailDocument>;

const renderDocument = (overrides: Partial<DocumentProps> = {}) =>
  render(
    <TicketDetailDocument
      ticketId={5}
      lines={[line]}
      total={8700}
      paid={2000}
      finished
      workNotes="Revisar el drenaje"
      canManage={false}
      {...overrides}
    />,
  );

describe('TicketDetailDocument (ZIG-I28-2)', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.localStorage.clear();
    mockDesktopWidth(true);
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('shows the line, the split totals and the balance still due', () => {
    renderDocument();

    expect(screen.getByTestId('document-line-description')).toHaveTextContent(
      'Equipo de 1 tonelada en recámara',
    );
    expect(screen.getByText('$4,200.00')).toBeInTheDocument();

    const totals = screen.getByTestId('ticket-document-totals');
    expect(within(totals).getByText('Servicios')).toBeInTheDocument();
    expect(within(totals).getByText('$8,400.00')).toBeInTheDocument();
    expect(within(totals).getByText('Materiales')).toBeInTheDocument();
    expect(within(totals).getByText('$300.00')).toBeInTheDocument();
    expect(within(totals).getByText('Total')).toBeInTheDocument();
    expect(within(totals).getByText('$8,700.00')).toBeInTheDocument();
    expect(within(totals).getByText('Pagado')).toBeInTheDocument();
    expect(within(totals).getByText('$2,000.00')).toBeInTheDocument();
    expect(within(totals).getByText('Saldo por pagar')).toBeInTheDocument();
    expect(within(totals).getByTestId('ticket-document-balance')).toHaveTextContent('$6,700.00');
    expect(screen.getByRole('button', { name: 'Detallado' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('hides Saldo por pagar once the ticket is fully paid', () => {
    renderDocument({ total: 8700, paid: 8700 });

    expect(screen.queryByText('Saldo por pagar')).toBeNull();
    expect(screen.queryByTestId('ticket-document-balance')).toBeNull();
    expect(screen.getByText('Pagado')).toBeInTheDocument();
  });

  it('hides Pagado on an open ticket and offers Agregar servicio and Agregar notas', () => {
    renderDocument({ finished: false, paid: 0, workNotes: null, canManage: true });

    expect(screen.queryByText('Pagado')).toBeNull();
    expect(screen.queryByText('Saldo por pagar')).toBeNull();
    expect(screen.getByRole('link', { name: 'Agregar servicio' })).toHaveAttribute(
      'href',
      '/tickets/5/edit',
    );
    expect(screen.getByText(/Sin notas todavía/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agregar notas' })).toHaveAttribute(
      'href',
      '/tickets/5/edit',
    );
  });

  it('renders work notes, and Sin notas when they are empty', () => {
    const { rerender } = renderDocument({ workNotes: 'Cambiar el filtro' });
    expect(screen.getByTestId('ticket-work-notes')).toHaveTextContent('Cambiar el filtro');

    rerender(
      <TicketDetailDocument
        ticketId={5}
        lines={[line]}
        total={8700}
        paid={2000}
        finished
        workNotes={null}
        canManage={false}
      />,
    );
    expect(screen.queryByTestId('ticket-work-notes')).toBeNull();
    expect(screen.getByText('Sin notas')).toBeInTheDocument();

    rerender(
      <TicketDetailDocument
        ticketId={5}
        lines={[line]}
        total={8700}
        paid={2000}
        finished
        workNotes=""
        canManage={false}
      />,
    );
    expect(screen.getByText('Sin notas')).toBeInTheDocument();
  });

  it('defaults the density switch to Detallado', () => {
    renderDocument();
    expect(screen.getByRole('button', { name: 'Detallado' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Compacto' })).toHaveAttribute('aria-pressed', 'false');
  });
});
