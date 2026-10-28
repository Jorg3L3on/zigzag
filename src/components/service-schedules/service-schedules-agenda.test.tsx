import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  listClientServiceScheduleServiceOptions,
  listClientServiceSchedulesPaginated,
  type ClientServiceScheduleAgendaItem,
} from '@/actions/client-service-schedules';
import { ServiceSchedulesAgenda } from '@/components/service-schedules/service-schedules-agenda';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';

jest.mock('@/actions/client-service-schedules', () => ({
  bulkClientServiceSchedules: jest.fn(),
  deleteClientServiceSchedule: jest.fn(),
  getClientServiceScheduleHistory: jest.fn(),
  listClientServiceScheduleServiceOptions: jest.fn(),
  listClientServiceSchedulesPaginated: jest.fn(),
  markClientServiceScheduleDone: jest.fn(),
  pauseClientServiceSchedule: jest.fn(),
  restoreClientServiceScheduleDates: jest.fn(),
  resumeClientServiceSchedule: jest.fn(),
  snoozeClientServiceSchedule: jest.fn(),
}));

jest.mock('@/components/service-schedules/schedule-form-dialog', () => ({
  ScheduleFormDialog: () => null,
}));

jest.mock('@/contexts/company-context', () => ({ useCompany: jest.fn() }));
jest.mock('@/hooks/use-permissions', () => ({ usePermissions: jest.fn() }));

const replace = jest.fn();
let search = '';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace }),
  usePathname: () => '/service-schedules',
  useSearchParams: () => new URLSearchParams(search),
}));

const mockList = listClientServiceSchedulesPaginated as jest.MockedFunction<
  typeof listClientServiceSchedulesPaginated
>;
const mockOptions = listClientServiceScheduleServiceOptions as jest.MockedFunction<
  typeof listClientServiceScheduleServiceOptions
>;
const mockUseCompany = useCompany as jest.MockedFunction<typeof useCompany>;
const mockUsePermissions = usePermissions as jest.MockedFunction<typeof usePermissions>;

const schedule = (overrides: Partial<ClientServiceScheduleAgendaItem>): ClientServiceScheduleAgendaItem => ({
  id: 1,
  clientId: 10,
  clientName: 'Ana Pérez',
  clientPhone: '5512345678',
  serviceId: 20,
  serviceName: 'Mantenimiento',
  intervalValue: 6,
  intervalUnit: 'month',
  lastServiceAt: '2026-04-10T18:00:00.000Z',
  nextDueAt: '2026-10-10T18:00:00.000Z',
  pausedAt: null,
  pauseReason: null,
  bucket: 'atrasados',
  daysUntilDue: -17,
  daysSinceLast: 200,
  ...overrides,
});

const arrange = ({ isSystem = false, companyId = 1 as number | null } = {}) => {
  mockUseCompany.mockReturnValue({
    selectedCompany: companyId ? { id: companyId, name: 'Acme' } : null,
    setSelectedCompany: jest.fn(),
  } as unknown as ReturnType<typeof useCompany>);
  mockUsePermissions.mockReturnValue({
    isSystem,
    permissions: [],
    loading: false,
    can: () => true,
  } as unknown as ReturnType<typeof usePermissions>);
  mockOptions.mockResolvedValue({ success: true, data: [{ id: 20, name: 'Mantenimiento' }] });
  mockList.mockResolvedValue({
    success: true,
    data: {
      items: [
        schedule({}),
        schedule({ id: 2, clientId: 11, clientName: 'Beto Ruiz', bucket: 'proximos', daysUntilDue: 5 }),
      ],
      counts: { 'por-atender': 2, atrasados: 1, proximos: 1, programados: 3, pausados: 0, todos: 5 },
      view: 'por-atender',
      total: 2,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    },
  });
};

const setDesktop = () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
};

const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLTableRowElement;

describe('ServiceSchedulesAgenda (ZIG-I33-5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    search = '';
    setDesktop();
  });

  it('draws the title with the count, view tabs with counts and no sort select', async () => {
    arrange();
    render(<ServiceSchedulesAgenda />);
    await screen.findByText('Ana Pérez');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Recordatorios de servicio · 5');
    const tabs = screen.getByRole('navigation', { name: 'Vistas de recordatorios' });
    expect(within(tabs).getByRole('button', { name: /^Por atender/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('schedule-tab-count-programados')).toHaveTextContent('3');
    expect(screen.queryByRole('combobox', { name: 'Ordenar recordatorios' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Filtrar por servicio' })).toBeInTheDocument();
    expect(screen.getByTestId('list-footer')).toHaveTextContent('2 de 2 recordatorios');
  });

  it('shows the pills of the standard and the next date with its relative line', async () => {
    arrange();
    render(<ServiceSchedulesAgenda />);
    await screen.findByText('Ana Pérez');

    expect(within(rowOf('Ana Pérez')).getByText('Atrasado')).toHaveAttribute('data-tone', 'red');
    expect(within(rowOf('Beto Ruiz')).getByText('Próximo')).toHaveAttribute('data-tone', 'amber');
    expect(within(rowOf('Ana Pérez')).getByText('hace 17 días')).toHaveClass('text-destructive');
  });

  it('opens the side panel by click, Enter or Space on the row, not from the checkbox cell', async () => {
    arrange();
    render(<ServiceSchedulesAgenda />);
    await screen.findByText('Ana Pérez');
    const row = rowOf('Ana Pérez');

    expect(row).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(replace).toHaveBeenLastCalledWith('/service-schedules?ver=1', { scroll: false });

    fireEvent.keyDown(rowOf('Beto Ruiz'), { key: ' ' });
    expect(replace).toHaveBeenLastCalledWith('/service-schedules?ver=2', { scroll: false });

    replace.mockClear();
    const checkbox = within(row).getByRole('checkbox');
    fireEvent.click(checkbox.closest('td') as HTMLElement);
    fireEvent.click(checkbox);
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(within(row).getByText('Mantenimiento'));
    expect(replace).toHaveBeenLastCalledWith('/service-schedules?ver=1', { scroll: false });
  });

  it('sorts by the column headers through ?orden, with aria-sort on the th', async () => {
    arrange();
    render(<ServiceSchedulesAgenda />);
    await screen.findByText('Ana Pérez');

    expect(screen.getByRole('columnheader', { name: /Próximo/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: /Cliente/ })).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByRole('columnheader', { name: /Estado/ })).not.toHaveAttribute('aria-sort');

    fireEvent.click(screen.getByRole('button', { name: 'Cliente' }));
    expect(replace).toHaveBeenLastCalledWith('/service-schedules?orden=cliente', { scroll: false });
    fireEvent.click(screen.getByRole('button', { name: 'Servicio' }));
    expect(replace).toHaveBeenLastCalledWith('/service-schedules?orden=servicio', { scroll: false });

    // The sorted column has one direction: clicking it again changes nothing.
    replace.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps Crear ticket and WhatsApp in the ⋯ menu, never as row buttons', async () => {
    arrange();
    const user = userEvent.setup();
    render(<ServiceSchedulesAgenda />);
    await screen.findByText('Ana Pérez');
    const row = rowOf('Ana Pérez');

    expect(within(row).queryByRole('link')).toBeNull();
    await user.click(within(row).getByRole('button', { name: 'Acciones del recordatorio de Ana Pérez' }));
    const items = (await screen.findAllByRole('menuitem')).map((item) => item.textContent?.trim());
    expect(items).toEqual([
      'Crear ticket',
      'Recordar por WhatsApp',
      'Marcar como hecho',
      'Posponer',
      'Pausar',
      'Editar',
      'Ver cliente',
      'Eliminar',
    ]);
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the selection bar with Posponer, Pausar, Eliminar and Cancelar', async () => {
    arrange();
    render(<ServiceSchedulesAgenda />);
    await screen.findByText('Ana Pérez');

    fireEvent.click(within(rowOf('Ana Pérez')).getByRole('checkbox'));
    fireEvent.click(within(rowOf('Beto Ruiz')).getByRole('checkbox'));
    const bar = screen.getByTestId('service-schedules-selection-bar');
    expect(bar).toHaveTextContent('2 seleccionados');
    for (const name of ['Posponer', 'Pausar', 'Eliminar', 'Cancelar']) {
      expect(within(bar).getByRole('button', { name })).toBeInTheDocument();
    }
    fireEvent.click(within(bar).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByTestId('service-schedules-selection-bar')).toBeNull();
  });

  it('asks a system operator without a company to pick one, not as an error', async () => {
    arrange({ isSystem: true, companyId: null });
    render(<ServiceSchedulesAgenda />);

    expect(await screen.findByText(/Los recordatorios aparecerán aquí/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mockList).not.toHaveBeenCalled();
  });
});
