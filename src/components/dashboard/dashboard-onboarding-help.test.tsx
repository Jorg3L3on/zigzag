import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardOnboardingHelp } from '@/components/dashboard/dashboard-onboarding-help';
import { buildCompanyOnboardingChecklist } from '@/lib/company-onboarding-checklist';

const fullPermissions = {
  canManageCompany: true,
  canCreateClients: true,
  canCreateServices: true,
  canCreateTickets: true,
  canCreateUsers: true,
  canViewTickets: true,
  canViewSchedules: true,
};

const buildChecklist = (
  overrides: Partial<Parameters<typeof buildCompanyOnboardingChecklist>[0]> = {},
) =>
  buildCompanyOnboardingChecklist({
    signals: {
      profileReady: false,
      totalClients: 0,
      totalServices: 0,
      totalTickets: 0,
      totalServicesSold: 0,
      hasPaidOrFinishedTicket: false,
      finishedTicketCount: 0,
      totalUsers: 1,
      totalServiceSchedules: 0,
    },
    permissions: {
      ...fullPermissions,
      canCreateServices: false,
    },
    ...overrides,
  });

describe('DashboardOnboardingHelp', () => {
  it('shows the guide-aligned setup order with permission-aware actions', () => {
    render(
      <DashboardOnboardingHelp
        checklist={buildChecklist({
          permissions: {
            ...fullPermissions,
            canCreateServices: false,
          },
        })}
      />,
    );

    expect(screen.getByText('Inicio rápido')).toBeInTheDocument();
    expect(screen.getByText('1. Configura Mi empresa')).toBeInTheDocument();
    expect(screen.getByText('4. Crea tu primer ticket')).toBeInTheDocument();
    expect(screen.getByText('5. Invita a tu equipo')).toBeInTheDocument();
    expect(screen.getByText('6. Factura PDF y recordatorios')).toBeInTheDocument();
    expect(screen.getByText('0 de 6')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mi empresa/i })).toHaveAttribute(
      'href',
      '/company',
    );
    expect(screen.queryByRole('link', { name: /Nuevo servicio/i })).toBeNull();
    expect(screen.getByRole('link', { name: /Crear ticket/i })).toHaveAttribute(
      'href',
      '/tickets/create',
    );
    expect(screen.getByRole('link', { name: /Invitar usuario/i })).toHaveAttribute(
      'href',
      '/users',
    );
    expect(screen.getAllByRole('link', { name: /Ver guía/i })).toHaveLength(6);
  });

  it('uses selected-company guidance for system users without tenant context', () => {
    render(
      <DashboardOnboardingHelp
        checklist={buildChecklist({
          signals: {
            profileReady: true,
            totalClients: 10,
            totalServices: 5,
            totalTickets: 8,
            totalServicesSold: 12,
            hasPaidOrFinishedTicket: true,
            finishedTicketCount: 3,
            totalUsers: 4,
            totalServiceSchedules: 2,
          },
        })}
        needsCompanyContext
      />,
    );

    expect(screen.getByText('Selecciona una empresa')).toBeInTheDocument();
    expect(screen.queryByText('Inicio rápido')).toBeNull();
  });

  it('keeps the guidance concise in a narrow mobile viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });
    window.dispatchEvent(new Event('resize'));

    render(
      <DashboardOnboardingHelp
        checklist={buildChecklist({
          signals: {
            profileReady: true,
            totalClients: 0,
            totalServices: 1,
            totalTickets: 0,
            totalServicesSold: 0,
            hasPaidOrFinishedTicket: false,
            finishedTicketCount: 0,
            totalUsers: 1,
            totalServiceSchedules: 0,
          },
          permissions: fullPermissions,
        })}
      />,
    );

    expect(screen.getByText('Inicio rápido')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText(/guía de 5 minutos/i)).toBeInTheDocument();
  });

  it('stays hidden once all activation steps are complete', () => {
    const { container } = render(
      <DashboardOnboardingHelp
        checklist={buildChecklist({
          signals: {
            profileReady: true,
            totalClients: 1,
            totalServices: 1,
            totalTickets: 1,
            totalServicesSold: 1,
            hasPaidOrFinishedTicket: true,
            finishedTicketCount: 1,
            totalUsers: 2,
            totalServiceSchedules: 1,
          },
        })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows dismiss only for admins and hides after dismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();

    const { rerender, container } = render(
      <DashboardOnboardingHelp
        checklist={buildChecklist()}
        canDismiss
        onDismiss={onDismiss}
      />,
    );

    expect(
      screen.getByRole('button', { name: /Ocultar guía de inicio rápido/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Ocultar guía de inicio rápido/i }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Ocultar', hidden: true }),
    );

    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(
      <DashboardOnboardingHelp
        checklist={buildChecklist({
          signals: {
            profileReady: false,
            totalClients: 0,
            totalServices: 0,
            totalTickets: 0,
            totalServicesSold: 0,
            hasPaidOrFinishedTicket: false,
            finishedTicketCount: 0,
            totalUsers: 1,
            totalServiceSchedules: 0,
            dismissedAt: '2026-07-11T00:00:00.000Z',
          },
        })}
        canDismiss
        onDismiss={onDismiss}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('does not show dismiss for users without company.manage', () => {
    render(<DashboardOnboardingHelp checklist={buildChecklist()} />);

    expect(
      screen.queryByRole('button', { name: /Ocultar guía de inicio rápido/i }),
    ).toBeNull();
  });
});
