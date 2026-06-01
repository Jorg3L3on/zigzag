'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Ticket,
  DollarSign,
  Wallet,
  ClipboardList,
  FileDown,
  AlertTriangle,
} from 'lucide-react';
import {
  TripledEmptyState,
  TripledMotionDiv,
  tripledStagger,
} from '@/components/tripled';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { DashboardKpiCard } from '@/components/dashboard/dashboard-kpi-card';
import { DashboardRecentTickets } from '@/components/dashboard/dashboard-recent-tickets';
import { DashboardServiceSchedulesWidget } from '@/components/dashboard/dashboard-service-schedules-widget';
import { DashboardOnboardingHelp } from '@/components/dashboard/dashboard-onboarding-help';
import type { DashboardKpiKey } from '@/lib/dashboard-kpi';
import { useCompany } from '@/contexts/company-context';
import {
  fetchDashboardMetrics,
  type DashboardMetrics,
} from '@/actions/dashboard';
import type { DashboardMonthCount } from '@/lib/dashboard-metrics';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
import {
  canCreateTicketFromSchedule,
  canWriteServiceSchedules,
} from '@/lib/service-schedules-rbac';

const MONTH_PRESETS: { value: DashboardMonthCount; label: string }[] = [
  { value: 1, label: '1 mes' },
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
];

const KPI_ICONS: Record<DashboardKpiKey, React.ReactNode> = {
  revenue: <DollarSign className="h-4 w-4 text-muted-foreground" />,
  cashCollected: <Wallet className="h-4 w-4 text-muted-foreground" />,
  outstandingBalance: <ClipboardList className="h-4 w-4 text-muted-foreground" />,
  activeTickets: <Ticket className="h-4 w-4 text-muted-foreground" />,
};

const DashboardLoadingSkeleton = () => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Skeleton className="h-9 w-28" />
      <Skeleton className="h-9 w-28" />
      <Skeleton className="h-9 w-28" />
    </div>
    <div className="grid grid-cols-2 gap-5 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-xl" />
      ))}
    </div>
    <div className="grid gap-5 sm:gap-4 lg:grid-cols-3">
      <Skeleton className="h-[380px] rounded-xl lg:col-span-2" />
      <Skeleton className="h-[380px] rounded-xl" />
    </div>
    <Skeleton className="h-64 rounded-xl" />
  </div>
);

export const DashboardMetricsClient = () => {
  const router = useRouter();
  const { status, data: session } = useSession();
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const [monthCount, setMonthCount] = React.useState<DashboardMonthCount>(1);
  const [metrics, setMetrics] = React.useState<DashboardMetrics | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (status === 'loading') {
      return;
    }
    if (!session?.user?.company_id) {
      router.replace('/login');
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const isSystem = session.user.company_is_system;
      const companyIdArg =
        isSystem
          ? (selectedCompany?.id ?? session.user.company_id)
          : undefined;

      const res = await fetchDashboardMetrics({
        companyId: companyIdArg,
        monthCount,
      });

      if (cancelled) {
        return;
      }
      setLoading(false);
      if (!res.success || !res.data) {
        setError(
          getErrorDisplayMessage(
            res,
            'No se pudieron cargar las métricas',
            res.errorType,
          ),
        );
        return;
      }
      setError(null);
      setMetrics(res.data);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [status, session, selectedCompany?.id, monthCount, router]);

  if (status === 'loading' || (loading && !metrics && !error)) {
    return <DashboardLoadingSkeleton />;
  }

  if (error && !metrics) {
    return (
      <TripledEmptyState
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Error al cargar"
        description={error}
        role="alert"
        action={
          <Button type="button" variant="outline" onClick={() => router.refresh()}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (!metrics) {
    return null;
  }

  const handleExportPdf = () => {
    const params = new URLSearchParams();
    params.set('monthCount', String(monthCount));
    if (session?.user.company_is_system && selectedCompany?.id != null) {
      params.set('company_id', String(selectedCompany.id));
    }
    const url = `/api/dashboard/report?${params.toString()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const canCreateClients = permissions.can(PERMISSIONS.clients.write);
  const canCreateServices = permissions.can(PERMISSIONS.services.write);
  const canCreateTickets = permissions.can(PERMISSIONS.tickets.write);
  const canCreateSchedules = canWriteServiceSchedules(permissions.can);
  const canCollectPayments = canCreateTicketFromSchedule(permissions.can);
  const needsCompanyContext =
    session?.user.company_is_system === true &&
    (selectedCompany == null || selectedCompany.is_system === true);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {error && metrics ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm text-muted-foreground md:mr-0">
          Periodo de ingresos
        </span>
        <Select
          value={String(monthCount)}
          onValueChange={(value) =>
            setMonthCount(Number(value) as DashboardMonthCount)
          }
        >
          <SelectTrigger
            className="min-h-11 w-[170px] rounded-xl sm:min-h-9"
            aria-label="Seleccionar periodo de ingresos"
          >
            <SelectValue placeholder="Seleccionar periodo" />
          </SelectTrigger>
          <SelectContent>
            {MONTH_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={String(preset.value)}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="default"
          className="min-h-11 gap-2 rounded-xl sm:min-h-9"
          onClick={handleExportPdf}
          aria-label="Exportar resumen del dashboard en PDF"
        >
          <FileDown className="h-4 w-4" aria-hidden />
          Exportar PDF
        </Button>
      </div>

      <DashboardOnboardingHelp
        totalClients={metrics.totalClients}
        totalServices={metrics.totalServices}
        totalTickets={metrics.totalTickets}
        totalServicesSold={metrics.totalServicesSold}
        canCreateClients={canCreateClients}
        canCreateServices={canCreateServices}
        canCreateTickets={canCreateTickets}
        canCreateSchedules={canCreateSchedules}
        canCollectPayments={canCollectPayments}
        needsCompanyContext={needsCompanyContext}
      />

      <TripledMotionDiv
        className="grid grid-cols-2 gap-5 sm:gap-4 lg:grid-cols-4"
        variants={tripledStagger}
        initial="hidden"
        animate="visible"
      >
        {metrics.kpis.map((kpi) => (
          <DashboardKpiCard
            key={kpi.key}
            kpi={kpi}
            icon={KPI_ICONS[kpi.key]}
          />
        ))}
      </TripledMotionDiv>

      <div className={loading ? 'pointer-events-none opacity-60' : ''}>
        <DashboardCharts
          revenueByMonth={metrics.revenueByMonth}
          paymentStatusBreakdown={metrics.paymentStatusBreakdown}
          revenueMonthCount={monthCount}
        />
      </div>

      <DashboardServiceSchedulesWidget />

      <DashboardRecentTickets tickets={metrics.recentTickets} />
    </div>
  );
};
