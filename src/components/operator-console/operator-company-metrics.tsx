'use client';

import React from 'react';
import {
  fetchDashboardMetrics,
  type DashboardMetricsResponse,
} from '@/actions/dashboard';
import {
  fetchOnboardingStatus,
  type OnboardingStatusResponse,
} from '@/actions/onboarding-status';
import { FormattedCurrency } from '@/components/formatted-currency';
import { TripledEmptyState, TripledMetricCard } from '@/components/tripled';
import { useCompany } from '@/contexts/company-context';
import { formatCompactCurrency, formatCompactNumber } from '@/lib/format-compact';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import {
  Banknote,
  ClipboardList,
  Loader2,
  Ticket,
  Users,
  UserRound,
  Wallet,
} from 'lucide-react';

type MetricsBundle = {
  totalTickets: number;
  activeTickets: number;
  totalUsers: number;
  totalClients: number;
  totalCashCollected: number;
  outstandingBalance: number;
};

const findKpiValue = (
  metrics: NonNullable<DashboardMetricsResponse['data']>,
  key: 'activeTickets' | 'outstandingBalance',
): number => metrics.kpis.find((kpi) => kpi.key === key)?.value ?? 0;

export const OperatorCompanyMetrics = () => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const isSystemTenant = selectedCompany?.is_system === true;

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [metrics, setMetrics] = React.useState<MetricsBundle | null>(null);

  React.useEffect(() => {
    if (!companyId || isSystemTenant) {
      setLoading(false);
      setError(null);
      setMetrics(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setMetrics(null);

    const load = async () => {
      try {
        const [dashboardResult, onboardingResult] = await Promise.all([
          fetchDashboardMetrics({ companyId }),
          fetchOnboardingStatus({ companyId }),
        ]);

        if (cancelled) {
          return;
        }

        if (!dashboardResult.success || !dashboardResult.data) {
          const errorType = classifyClientError(
            null,
            undefined,
            dashboardResult.errorType,
          );
          setError(
            getErrorMessageByType(
              errorType,
              dashboardResult.error ||
                'No se pudieron cargar las métricas del negocio',
            ),
          );
          setMetrics(null);
          return;
        }

        const onboardingData = (
          onboardingResult as OnboardingStatusResponse
        ).data;
        const totalUsers =
          onboardingResult.success && onboardingData
            ? onboardingData.totalUsers
            : 0;

        setMetrics({
          totalTickets: dashboardResult.data.totalTickets,
          activeTickets: findKpiValue(dashboardResult.data, 'activeTickets'),
          totalUsers,
          totalClients: dashboardResult.data.totalClients,
          totalCashCollected: dashboardResult.data.totalCashCollected,
          outstandingBalance: findKpiValue(
            dashboardResult.data,
            'outstandingBalance',
          ),
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          getErrorMessageByType(
            classifyClientError(loadError),
            'No se pudieron cargar las métricas del negocio',
          ),
        );
        setMetrics(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [companyId, isSystemTenant]);

  if (!companyId || isSystemTenant) {
    return null;
  }

  return (
    <section className="space-y-4 pt-2">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Pulso del negocio
        </h2>
        <p className="text-sm text-muted-foreground">
          Volumen, personas y dinero de {selectedCompany?.name}.
        </p>
      </div>

      {loading ? (
        <div className="flex h-28 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : !metrics ? (
        <TripledEmptyState
          icon={<ClipboardList className="h-4 w-4" aria-hidden />}
          title="Sin métricas"
          description="No hay datos de negocio para esta empresa todavía."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <TripledMetricCard
            title="Tickets"
            icon={<Ticket className="h-4 w-4 text-muted-foreground" aria-hidden />}
            value={formatCompactNumber(metrics.totalTickets)}
            subtitle="Creados en total"
          />
          <TripledMetricCard
            title="Tickets activos"
            icon={
              <ClipboardList
                className="h-4 w-4 text-muted-foreground"
                aria-hidden
              />
            }
            value={formatCompactNumber(metrics.activeTickets)}
            subtitle="Sin finalizar"
          />
          <TripledMetricCard
            title="Usuarios"
            icon={<Users className="h-4 w-4 text-muted-foreground" aria-hidden />}
            value={formatCompactNumber(metrics.totalUsers)}
            subtitle="Cuentas en la empresa"
          />
          <TripledMetricCard
            title="Clientes"
            icon={
              <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
            }
            value={formatCompactNumber(metrics.totalClients)}
            subtitle="Clientes activos"
          />
          <TripledMetricCard
            title="Cobrado"
            icon={
              <Banknote className="h-4 w-4 text-muted-foreground" aria-hidden />
            }
            value={formatCompactCurrency(metrics.totalCashCollected)}
            subtitle={<FormattedCurrency amount={metrics.totalCashCollected} />}
          />
          <TripledMetricCard
            title="Por cobrar"
            icon={
              <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
            }
            value={formatCompactCurrency(metrics.outstandingBalance)}
            subtitle={<FormattedCurrency amount={metrics.outstandingBalance} />}
          />
        </div>
      )}
    </section>
  );
};
