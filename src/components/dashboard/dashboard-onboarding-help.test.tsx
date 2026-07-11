import { render, screen } from '@testing-library/react';
import { DashboardOnboardingHelp } from '@/components/dashboard/dashboard-onboarding-help';
import { buildCompanyOnboardingChecklist } from '@/lib/company-onboarding-checklist';

const buildChecklist = (
  overrides: Partial<Parameters<typeof buildCompanyOnboardingChecklist>[0]> = {},
) =>
  buildCompanyOnboardingChecklist({
    signals: { profileReady: false, totalClients: 0, totalServices: 0 },
    permissions: {
      canManageCompany: true,
      canCreateClients: true,
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
            canManageCompany: true,
            canCreateClients: true,
            canCreateServices: false,
          },
        })}
      />,
    );

    expect(screen.getByText('Inicio rápido')).toBeInTheDocument();
    expect(screen.getByText('1. Configura Mi empresa')).toBeInTheDocument();
    expect(screen.getByText('2. Arma tu catálogo de servicios')).toBeInTheDocument();
    expect(screen.getByText('3. Registra clientes')).toBeInTheDocument();
    expect(screen.getByText('0 de 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mi empresa/i })).toHaveAttribute(
      'href',
      '/company',
    );
    expect(screen.queryByRole('link', { name: /Nuevo servicio/i })).toBeNull();
    expect(screen.getByRole('link', { name: /Nuevo cliente/i })).toHaveAttribute(
      'href',
      '/clients/new',
    );
    expect(screen.getAllByRole('link', { name: /Ver guía/i })).toHaveLength(3);
  });

  it('uses selected-company guidance for system users without tenant context', () => {
    render(
      <DashboardOnboardingHelp
        checklist={buildChecklist({
          signals: { profileReady: true, totalClients: 10, totalServices: 5 },
        })}
        needsCompanyContext
      />,
    );

    expect(screen.getByText('Selecciona una empresa')).toBeInTheDocument();
    expect(screen.getByText(/menú superior/i)).toBeInTheDocument();
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
          signals: { profileReady: true, totalClients: 0, totalServices: 1 },
          permissions: {
            canManageCompany: true,
            canCreateClients: true,
            canCreateServices: true,
          },
        })}
      />,
    );

    expect(screen.getByText('Inicio rápido')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/guía de 5 minutos/i)).toBeInTheDocument();
  });

  it('stays hidden once setup steps are complete', () => {
    const { container } = render(
      <DashboardOnboardingHelp
        checklist={buildChecklist({
          signals: { profileReady: true, totalClients: 1, totalServices: 1 },
        })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
