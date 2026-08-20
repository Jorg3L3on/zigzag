/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import type { TechnicianDayTicket } from '@/lib/technician-day-queue';

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

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => permission === 'tickets.write',
    isSystem: false,
    loading: false,
  }),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({
    selectedCompany: { id: 1, name: 'Demo Co' },
  }),
}));

jest.mock('@/components/tickets/ticket-list-collect-payment-dialog', () => ({
  TicketListCollectPaymentDialog: () => null,
}));

import { DashboardTechnicianDayWidget } from '@/components/dashboard/dashboard-technician-day-widget';

const baseItem = (
  overrides: Partial<TechnicianDayTicket> = {},
): TechnicianDayTicket => ({
  id: '10',
  clientName: 'Cliente Demo',
  clientTel: '5512345678',
  ticketDate: '2026-08-12T00:00:00.000Z',
  total: 100,
  paid: 0,
  finished: false,
  balanceDue: 100,
  paymentStatus: 'pending',
  isOverdue: false,
  servicesSummary: 'Fumigación',
  ...overrides,
});

describe('DashboardTechnicianDayWidget', () => {
  it('renders empty state and cobranza link', () => {
    render(
      <DashboardTechnicianDayWidget
        canRead
        missingCompany={false}
        permissionsLoading={false}
        loading={false}
        error={null}
        items={[]}
        todayCount={0}
        overdueCount={0}
        onRetry={() => undefined}
      />,
    );

    expect(screen.getByText('Sin trabajo pendiente')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ir a cobranza/i })).toHaveAttribute(
      'href',
      '/cobranza',
    );
    expect(
      screen.getByRole('link', { name: /Ver cobranza por cobrar/i }),
    ).toHaveAttribute('href', '/cobranza');
  });

  it('shows Abrir for unfinished writable tickets and Enviar menu trigger', () => {
    render(
      <DashboardTechnicianDayWidget
        canRead
        missingCompany={false}
        permissionsLoading={false}
        loading={false}
        error={null}
        items={[
          baseItem(),
          baseItem({
            id: '11',
            clientName: 'Sin Tel',
            clientTel: null,
            isOverdue: true,
          }),
        ]}
        todayCount={1}
        overdueCount={1}
        onRetry={() => undefined}
      />,
    );

    expect(
      screen.getByRole('link', { name: /Abrir y editar ticket 10/i }),
    ).toHaveAttribute('href', '/tickets/10/edit');
    expect(
      screen.getByRole('button', { name: /Sin teléfono para 11/i }),
    ).toBeDisabled();
    expect(
      screen.getAllByTestId('field-send-menu-trigger').length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Atrasado')).toBeTruthy();
    expect(screen.getByText('1 hoy · 1 atrasados')).toBeTruthy();
  });
});
