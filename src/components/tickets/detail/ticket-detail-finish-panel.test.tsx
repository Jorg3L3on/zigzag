/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketDetailFinishPanel } from '@/components/tickets/detail/ticket-detail-finish-panel';

const mockFinishTicket = jest.fn();
const mockToastError = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

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

jest.mock('@/actions/tickets', () => ({
  finishTicket: (...args: unknown[]) => mockFinishTicket(...args),
}));

jest.mock('@/actions/client-service-schedules', () => ({
  listClientServiceSchedulesForClient: jest.fn(async () => ({
    success: true,
    data: [],
  })),
  upsertClientServiceSchedule: jest.fn(),
}));

jest.mock('@/lib/ticket-invoice-download', () => ({
  fetchAndDeliverTicketInvoice: jest.fn(async () => 'downloaded'),
}));

describe('TicketDetailFinishPanel', () => {
  beforeEach(() => {
    mockFinishTicket.mockReset();
    mockToastError.mockClear();
  });

  it('disables finish when there are no services and links to services', () => {
    render(
      <TicketDetailFinishPanel
        ticketId={5}
        clientId={2}
        clientName="Cliente"
        total={100}
        ticketDate={new Date('2026-07-01')}
        serviceLines={[]}
        downloadFileName="t.pdf"
      />,
    );

    expect(
      screen.getByRole('button', { name: /terminar y generar recibo/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('link', { name: /ir a servicios/i }),
    ).toHaveAttribute('href', '/tickets/5/edit');
    expect(document.getElementById('terminar-ticket')).toBeNull();
    expect(document.getElementById('finalizar')?.tagName).toBe('SECTION');
  });

  it('blocks partial amount above total', async () => {
    const user = userEvent.setup();
    render(
      <TicketDetailFinishPanel
        ticketId={5}
        clientId={2}
        clientName="Cliente"
        total={100}
        ticketDate={new Date('2026-07-01')}
        serviceLines={[{ serviceId: 1, serviceName: 'Servicio' }]}
        downloadFileName="t.pdf"
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Una parte' }));
    await user.type(screen.getByLabelText('Cuánto pagó'), '150');

    expect(screen.getByText(/no puede ser mayor que el total/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /terminar y generar recibo/i }),
    ).toBeDisabled();
    expect(mockFinishTicket).not.toHaveBeenCalled();
  });

  it('asks the listo question: Todo / Una parte / Nada aún, none preselected (ZIG-I13-4)', async () => {
    const user = userEvent.setup();
    render(
      <TicketDetailFinishPanel
        ticketId={5}
        clientId={2}
        clientName="Cliente"
        total={100}
        ticketDate={new Date('2026-07-01')}
        serviceLines={[{ serviceId: 1, serviceName: 'Servicio' }]}
        downloadFileName="t.pdf"
      />,
    );

    expect(screen.getByRole('heading', { name: '¿Cómo pagó el cliente?' })).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    }
    const finish = screen.getByRole('button', { name: /terminar y generar recibo/i });
    expect(finish).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Nada aún' }));
    expect(finish).toBeEnabled();
  });
});

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

describe('TicketDetailFinishPanel desktop (ZIG-I28-3)', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mockFinishTicket.mockReset();
    mockToastError.mockClear();
    mockDesktopWidth(true);
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('shows Terminar ticket, the total, bordered options and a focusable 44px button', async () => {
    const user = userEvent.setup();
    render(
      <TicketDetailFinishPanel
        ticketId={5}
        clientId={2}
        clientName="Cliente"
        total={100}
        folio="R-0012"
        ticketDate={new Date('2026-07-01')}
        serviceLines={[{ serviceId: 1, serviceName: 'Servicio' }]}
        downloadFileName="t.pdf"
      />,
    );

    const card = document.getElementById('terminar-ticket');
    expect(card?.tagName).toBe('SECTION');
    expect(card).toHaveAttribute('tabindex', '-1');
    card?.focus();
    expect(card).toHaveFocus();

    expect(screen.getByRole('heading', { name: 'Terminar ticket' })).toBeInTheDocument();
    expect(screen.getByText('Total del ticket')).toBeInTheDocument();
    expect(screen.getAllByText('$100.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Registra el pago inicial y genera el recibo')).toBeNull();

    // Canvas EnProceso: bordered radio rows with a hint each, none chosen.
    expect(screen.getByRole('group', { name: '¿Cómo pagó el cliente?' })).toBeInTheDocument();
    for (const name of ['Pagó todo', 'Pagó una parte', 'Aún no paga']) {
      const option = screen.getByRole('radio', { name });
      expect(option).not.toBeChecked();
      expect(option.closest('label')).toHaveClass('border');
    }
    expect(screen.getByText('Anticipo o primer abono')).toBeInTheDocument();
    expect(screen.getByText('Queda pendiente de cobro')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Pagó una parte' }));
    expect(screen.getByRole('spinbutton', { name: 'Cuánto pagó' })).toBeInTheDocument();

    const finish = screen.getByRole('button', { name: /terminar y generar recibo/i });
    expect(finish).toBeDisabled();
    expect(finish).toHaveClass('h-11', 'md:h-11');
    expect(finish.className).not.toContain('md:h-10');
    expect(finish).toHaveAttribute('id', 'terminar-ticket-button');
    expect(
      screen.getByText(
        'Se registra el pago, se crea el recibo R-0012 y te preguntamos si quieres recordatorios de servicio para este cliente.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Aún no paga' }));
    expect(finish).toBeEnabled();
    finish.focus();
    expect(finish).toHaveFocus();
  });

  it('stays disabled without services, with the warning and no invented folio', () => {
    render(
      <TicketDetailFinishPanel
        ticketId={5}
        clientId={2}
        clientName="Cliente"
        total={100}
        ticketDate={new Date('2026-07-01')}
        serviceLines={[]}
        downloadFileName="t.pdf"
      />,
    );

    expect(
      screen.getByRole('button', { name: /terminar y generar recibo/i }),
    ).toBeDisabled();
    expect(screen.getByRole('link', { name: /ir a servicios/i })).toHaveAttribute(
      'href',
      '/tickets/5/edit',
    );
    expect(screen.getByText(/agrega al menos un servicio/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Se registra el pago, se crea el recibo y te preguntamos si quieres recordatorios de servicio para este cliente.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/R-\d|R-nnnn/)).toBeNull();
  });
});
