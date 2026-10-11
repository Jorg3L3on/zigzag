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
      screen.getByRole('button', { name: /finalizar y generar recibo/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('link', { name: /ir a servicios/i }),
    ).toHaveAttribute('href', '/tickets/5/services');
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
      screen.getByRole('button', { name: /finalizar y generar recibo/i }),
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
    const finish = screen.getByRole('button', { name: /finalizar y generar recibo/i });
    expect(finish).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Nada aún' }));
    expect(finish).toBeEnabled();
  });
});
