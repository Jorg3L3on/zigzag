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

    await user.click(screen.getByRole('button', { name: /pago parcial/i }));
    const input = screen.getByLabelText(/cuánto pagó el cliente/i);
    await user.clear(input);
    await user.type(input, '150');
    await user.tab();

    expect(
      screen.getByText(/no puede superar el total del ticket/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /finalizar y generar recibo/i }),
    ).toBeDisabled();
    expect(mockFinishTicket).not.toHaveBeenCalled();
  });
});
