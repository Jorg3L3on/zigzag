/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, within } from '@testing-library/react';

import { DashboardTuDia } from '@/components/dashboard/dashboard-tu-dia';
import type { DashboardDayQueue } from '@/lib/dashboard-day-queue';
import type { LocalJob } from '@/lib/field-jobs/types';

let mockGranted: string[] = [];
let mockLocalJobs: LocalJob[] = [];
const mockGetQueue = jest.fn();

jest.mock('@/actions/dashboard-day-queue', () => ({
  getDashboardDayQueue: (companyId: unknown) => mockGetQueue(companyId),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    can: (permission?: string) => !permission || mockGranted.includes(permission),
    loading: false,
    isSystem: false,
  }),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 7, name: 'ClimaTotal Demo' } }),
}));

jest.mock('@/hooks/use-field-job-store', () => ({
  useFieldJobStore: () => ({ jobs: mockLocalJobs, loading: false, reload: jest.fn() }),
}));

jest.mock('@/hooks/use-field-job-sync', () => ({
  useFieldJobSync: () => ({
    pendingCount: mockLocalJobs.length,
    syncing: false,
    flushNow: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('@/components/tickets/ticket-list-collect-payment-dialog', () => ({
  TicketListCollectPaymentDialog: ({ ticketId }: { ticketId: number }) => (
    <div role="dialog" aria-label={`Cobrar ${ticketId}`} />
  ),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const dayTicket = (id: string, overdue: boolean, client: string) => ({
  id,
  clientName: client,
  clientTel: '5551234567',
  ticketDate: overdue ? '2026-07-01T10:00:00.000Z' : new Date().toISOString(),
  total: 500,
  paid: 0,
  finished: false,
  balanceDue: 500,
  paymentStatus: 'pending' as const,
  isOverdue: overdue,
  servicesSummary: 'Mantenimiento de cuarto frío',
});

const queue = (overrides: Partial<DashboardDayQueue> = {}): DashboardDayQueue => ({
  counts: { hoy: 1, atrasados: 8, porCobrar: 24, recordatorios: 13 },
  porCobrarBalance: 29015,
  hoy: [dayTicket('1072', false, 'Plaza Comercial Aurora')],
  atrasados: [dayTicket('1047', true, 'Centro Logístico Norte')],
  porCobrar: [
    {
      id: '1049',
      client_name: 'Terminal de Autobuses del Caribe',
      client_tel: '5550001111',
      ticket_date: new Date('2026-06-10'),
      created_at: new Date('2026-06-10'),
      total: 1600,
      paid: 0,
      finished: true,
      company_id: 7,
      balanceDue: 1600,
      paymentStatus: 'pending',
      daysOutstanding: 120,
      agingBucket: '30+',
    },
  ],
  recordatorios: [
    {
      id: 3,
      clientId: 11,
      clientName: 'Manufactura DeltaPack',
      clientPhone: null,
      serviceId: 22,
      serviceName: 'Mantenimiento preventivo A/C',
      nextDueAt: '2026-06-11T00:00:00.000Z',
      overdue: true,
    },
  ],
  ...overrides,
});

const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('DashboardTuDia', () => {
  beforeEach(() => {
    mockGranted = ['tickets.read', 'tickets.write', 'clients.write'];
    mockLocalJobs = [];
    mockGetQueue.mockReset();
  });

  it('renders the four counts from the server and opens on Hoy', () => {
    render(<DashboardTuDia initialQueue={queue()} />);

    expect(tab(/1\s*Hoy/)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/8\s*Atrasados/)).toBeInTheDocument();
    expect(tab(/24\s*Por cobrar/)).toBeInTheDocument();
    expect(tab(/13\s*Recordat/)).toBeInTheDocument();
    expect(screen.getByText('Plaza Comercial Aurora')).toBeInTheDocument();
    // Server data came with the page: no client fetch.
    expect(mockGetQueue).not.toHaveBeenCalled();
  });

  it('falls back to the first filter with work when Hoy is empty', () => {
    render(
      <DashboardTuDia
        initialQueue={queue({
          counts: { hoy: 0, atrasados: 8, porCobrar: 24, recordatorios: 13 },
          hoy: [],
        })}
      />,
    );

    expect(tab(/Atrasados/)).toHaveAttribute('aria-selected', 'true');
    const list = screen.getByRole('list', { name: /Atrasados/ });
    expect(within(list).getByRole('link', { name: 'Finalizar' })).toHaveAttribute(
      'href',
      '/tickets/1047#finalizar',
    );
  });

  it('keeps campo on Hoy even when it is empty', () => {
    render(
      <DashboardTuDia
        campo
        initialQueue={queue({
          counts: { hoy: 0, atrasados: 8, porCobrar: 24, recordatorios: 13 },
          hoy: [],
        })}
      />,
    );

    expect(tab(/Hoy/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Nada para hoy')).toBeInTheDocument();
  });

  it('switches the one list when another tile is picked', () => {
    render(<DashboardTuDia initialQueue={queue()} />);

    fireEvent.click(tab(/Por cobrar/));
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar ticket 1049' }));
    expect(screen.getByRole('dialog', { name: 'Cobrar 1049' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver cobranza/ })).toHaveAttribute(
      'href',
      '/cobranza',
    );

    fireEvent.click(tab(/Recordat/));
    expect(screen.getByRole('link', { name: 'Crear ticket' })).toHaveAttribute(
      'href',
      '/tickets/create?clientId=11&serviceId=22',
    );
  });

  it('shows open-only actions without write permission', () => {
    mockGranted = ['tickets.read'];
    render(
      <DashboardTuDia
        initialQueue={queue({
          counts: { hoy: 0, atrasados: 8, porCobrar: 24, recordatorios: 13 },
          hoy: [],
        })}
      />,
    );

    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute(
      'href',
      '/tickets/1047',
    );
    fireEvent.click(tab(/Por cobrar/));
    expect(screen.queryByRole('button', { name: /Cobrar ticket/ })).not.toBeInTheDocument();
  });

  it('hides Recordatorios without schedule read permission', () => {
    mockGranted = [];
    render(<DashboardTuDia initialQueue={queue()} />);

    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.queryByRole('tab', { name: /Recordat/ })).not.toBeInTheDocument();
  });

  it('lists pending offline captures in Hoy with their badge', () => {
    mockLocalJobs = [
      {
        localJobId: 'local-1',
        companyId: 7,
        kind: 'create',
        syncStatus: 'pending',
        syncError: null,
        remoteTicketId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        payload: { client_name: 'Cliente sin señal', finished: true, total: 300, paid: 0 },
      } as unknown as LocalJob,
    ];
    render(<DashboardTuDia initialQueue={queue()} />);

    expect(tab(/2\s*Hoy/)).toBeInTheDocument();
    expect(screen.getByText('Cliente sin señal')).toBeInTheDocument();
    expect(screen.getByText('Pendiente de subir')).toBeInTheDocument();
    expect(screen.getByTestId('field-sync-now-button')).toBeInTheDocument();
  });

  it('fetches when the page had no queue', async () => {
    mockGetQueue.mockResolvedValue({ success: true, data: queue() });
    render(<DashboardTuDia initialQueue={null} />);

    expect(await screen.findByText('Plaza Comercial Aurora')).toBeInTheDocument();
    expect(mockGetQueue).toHaveBeenCalledWith(undefined);
  });
});
