import { render, screen } from '@testing-library/react';
import {
  DashboardOnboardingHelp,
  shouldShowDashboardOnboardingHelp,
} from '@/components/dashboard/dashboard-onboarding-help';

describe('DashboardOnboardingHelp', () => {
  it('shows the tenant setup order with permission-aware actions', () => {
    render(
      <DashboardOnboardingHelp
        totalClients={0}
        totalServices={0}
        totalTickets={0}
        totalServicesSold={0}
        canCreateClients
        canCreateServices={false}
        canCreateTickets
        canCreateSchedules={false}
        canCollectPayments
      />,
    );

    expect(screen.getByText('Ruta de inicio')).toBeInTheDocument();
    expect(screen.getByText('1. Registra clientes')).toBeInTheDocument();
    expect(screen.getByText('2. Define servicios')).toBeInTheDocument();
    expect(screen.getByText('3. Crea tickets')).toBeInTheDocument();
    expect(screen.getByText('4. Programa recordatorios')).toBeInTheDocument();
    expect(screen.getByText('5. Cobra y finaliza')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nuevo cliente/i })).toHaveAttribute(
      'href',
      '/clients/new',
    );
    expect(screen.queryByRole('link', { name: /Nuevo servicio/i })).toBeNull();
    expect(screen.getByRole('link', { name: /Crear ticket/i })).toHaveAttribute(
      'href',
      '/tickets/create',
    );
    expect(screen.getAllByRole('link', { name: /Ver guía/i })).toHaveLength(5);
  });

  it('uses selected-company guidance for system users without tenant context', () => {
    render(
      <DashboardOnboardingHelp
        totalClients={10}
        totalServices={5}
        totalTickets={20}
        totalServicesSold={8}
        canCreateClients
        canCreateServices
        canCreateTickets
        canCreateSchedules
        canCollectPayments
        needsCompanyContext
      />,
    );

    expect(screen.getByText('Selecciona una empresa')).toBeInTheDocument();
    expect(screen.getByText(/menú superior/i)).toBeInTheDocument();
    expect(screen.queryByText('Ruta de inicio')).toBeNull();
  });

  it('keeps the guidance concise in a narrow mobile viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });
    window.dispatchEvent(new Event('resize'));

    render(
      <DashboardOnboardingHelp
        totalClients={0}
        totalServices={1}
        totalTickets={0}
        totalServicesSold={0}
        canCreateClients
        canCreateServices
        canCreateTickets
        canCreateSchedules
        canCollectPayments
      />,
    );

    expect(screen.getByText('Ruta de inicio')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText(/sin perder datos/i)).toBeInTheDocument();
  });

  it('stays hidden once the company has core operational data', () => {
    expect(
      shouldShowDashboardOnboardingHelp({
        totalClients: 1,
        totalServices: 1,
        totalTickets: 1,
      }),
    ).toBe(false);
  });
});
