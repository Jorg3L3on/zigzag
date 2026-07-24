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
import { DashboardActivityFeed } from '@/components/dashboard/dashboard-activity-feed';
import { DashboardKpiCard } from '@/components/dashboard/dashboard-kpi-card';
import { DashboardNeedsAttention } from '@/components/dashboard/dashboard-needs-attention';
import { DashboardPageIntro } from '@/components/dashboard/dashboard-page-intro';
import { DashboardQuickActions } from '@/components/dashboard/dashboard-quick-actions';
import { DashboardServiceSchedulesWidget } from '@/components/dashboard/dashboard-service-schedules-widget';
import { DashboardOnboardingHelp } from '@/components/dashboard/dashboard-onboarding-help';
import {
  buildCompanyOnboardingChecklist,
  type OnboardingChecklistSignals,
} from '@/lib/company-onboarding-checklist';
import {
  buildDashboardAttentionItems,
  countSchedulesDueToday,
} from '@/lib/dashboard-attention';
import type { DashboardKpiKey } from '@/lib/dashboard-kpi';
import { useCompany } from '@/contexts/company-context';
import {
  fetchDashboardMetrics,
  type DashboardMetrics,
} from '@/actions/dashboard';
import { fetchOnboardingStatus, dismissOnboardingChecklist } from '@/actions/onboarding-status';
import type { DashboardMonthCount } from '@/lib/dashboard-metrics';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { useDashboardUrgentSchedules } from '@/hooks/use-dashboard-urgent-schedules';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
import { canReadServiceSchedules } from '@/lib/service-schedules-rbac';

const MONTH_PRESETS: { value: DashboardMonthCount; label: string }[] = [
  { value: 1, label: '1 mes' },
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
];

const KPI_ICONS: Record<DashboardKpiKey, React.ReactNode> = {
  revenue: <DollarSign className="h-4 w-4" aria-hidden />,
  cashCollected: <Wallet className="h-4 w-4" aria-hidden />,
  outstandingBalance: <ClipboardList className="h-4 w-4" aria-hidden />,
  activeTickets: <Ticket className="h-4 w-4" aria-hidden />,
};

const DashboardLoadingSkeleton = () => (
  <div className="flex flex-col gap-6 md:gap-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 sm:h-9 sm:w-72" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 w-[170px] rounded-xl sm:h-9" />
        <Skeleton className="h-11 w-32 rounded-xl sm:h-9" />
        <Skeleton className="h-11 w-32 rounded-xl sm:h-9" />
      </div>
    </div>
    <Skeleton className="h-36 rounded-xl" />
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Skeleton className="h-[280px] rounded-xl lg:col-span-2" />
      <Skeleton className="h-[280px] rounded-xl" />
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Skeleton className="h-64 rounded-xl lg:col-span-1" />
      <Skeleton className="h-64 rounded-xl lg:col-span-2" />
    </div>
    <Skeleton className="h-28 rounded-xl" />
  </div>
);

export const DashboardMetricsClient = () => {
  const router = useRouter();
  const { status, data: session } = useSession();
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const urgentSchedules = useDashboardUrgentSchedules();
  const [monthCount, setMonthCount] = React.useState<DashboardMonthCount>(1);
  const [metrics, setMetrics] = React.useState<DashboardMetrics | null>(null);
  const [onboardingSignals, setOnboardingSignals] =
    React.useState<OnboardingChecklistSignals | null>(null);
  const [isDismissingChecklist, setIsDismissingChecklist] = React.useState(false);
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

      const [res, onboardingRes] = await Promise.all([
        fetchDashboardMetrics({
          companyId: companyIdArg,
          monthCount,
        }),
        fetchOnboardingStatus({
          companyId: companyIdArg,
        }),
      ]);

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
      setOnboardingSignals(
        onboardingRes.success && onboardingRes.data
          ? onboardingRes.data
          : {
              profileReady: false,
              totalClients: res.data.totalClients,
              totalServices: res.data.totalServices,
              totalTickets: res.data.totalTickets,
              totalServicesSold: res.data.totalServicesSold,
              hasPaidOrFinishedTicket: false,
              finishedTicketCount: 0,
              totalUsers: 0,
              totalServiceSchedules: 0,
              dismissedAt: null,
            },
      );
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [status, session, selectedCompany?.id, monthCount, router]);

  const needsCompanyContext =
    session?.user.company_is_system === true &&
    (selectedCompany == null || selectedCompany.is_system === true);

  const onboardingPermissions = React.useMemo(
    () => ({
      canManageCompany: permissions.can(PERMISSIONS.company.manage),
      canCreateClients: permissions.can(PERMISSIONS.clients.write),
      canCreateServices: permissions.can(PERMISSIONS.services.write),
      canCreateTickets: permissions.can(PERMISSIONS.tickets.write),
      canCreateUsers: permissions.can(PERMISSIONS.users.write),
      canViewTickets: permissions.can(PERMISSIONS.tickets.read),
      canViewSchedules: canReadServiceSchedules(permissions.can),
    }),
    [permissions],
  );

  const onboardingChecklist = React.useMemo(() => {
    const fallbackSignals = {
      profileReady: false,
      totalClients: metrics?.totalClients ?? 0,
      totalServices: metrics?.totalServices ?? 0,
      totalTickets: metrics?.totalTickets ?? 0,
      totalServicesSold: metrics?.totalServicesSold ?? 0,
      hasPaidOrFinishedTicket: false,
      finishedTicketCount: 0,
      totalUsers: 0,
      totalServiceSchedules: 0,
      dismissedAt: null,
    };

    return buildCompanyOnboardingChecklist({
      signals: onboardingSignals ?? fallbackSignals,
      permissions: onboardingPermissions,
      needsCompanyContext,
    });
  }, [
    metrics?.totalClients,
    metrics?.totalServices,
    metrics?.totalTickets,
    metrics?.totalServicesSold,
    needsCompanyContext,
    onboardingPermissions,
    onboardingSignals,
  ]);

  const handleDismissOnboardingChecklist = React.useCallback(async () => {
    setIsDismissingChecklist(true);
    const isSystem = session?.user.company_is_system;
    const companyIdArg =
      isSystem ? (selectedCompany?.id ?? session?.user.company_id) : undefined;

    const result = await dismissOnboardingChecklist({
      companyId: companyIdArg,
    });
    setIsDismissingChecklist(false);

    if (!result.success) {
      setError(
        getErrorDisplayMessage(
          result,
          'No se pudo ocultar la guía de inicio',
          result.errorType,
        ),
      );
      return;
    }

    setOnboardingSignals((current) =>
      current
        ? {
            ...current,
            dismissedAt: new Date().toISOString(),
          }
        : current,
    );
  }, [selectedCompany?.id, session?.user.company_id, session?.user.company_is_system]);

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

  const buildReportUrl = (format?: 'csv') => {
    const params = new URLSearchParams();
    params.set('monthCount', String(monthCount));
    if (format) {
      params.set('format', format);
    }
    if (session?.user.company_is_system && selectedCompany?.id != null) {
      params.set('company_id', String(selectedCompany.id));
    }
    return `/api/dashboard/report?${params.toString()}`;
  };

  const handleExportPdf = () => {
    window.open(buildReportUrl(), '_blank', 'noopener,noreferrer');
  };

  const handleExportCsv = () => {
    window.open(buildReportUrl('csv'), '_blank', 'noopener,noreferrer');
  };

  const companyLabel =
    selectedCompany?.name ?? session?.user.company_name ?? null;

  const activeTicketsKpi =
    metrics.kpis.find((kpi) => kpi.key === 'activeTickets')?.value ?? 0;

  const schedulesReady =
    urgentSchedules.canRead &&
    !urgentSchedules.missingCompany &&
    !urgentSchedules.permissionsLoading;

  const attentionItems = buildDashboardAttentionItems({
    paymentStatusBreakdown: metrics.paymentStatusBreakdown,
    activeTickets: activeTicketsKpi,
    overdueSchedules: schedulesReady ? urgentSchedules.atrasados.length : null,
    dueTodaySchedules: schedulesReady
      ? countSchedulesDueToday(urgentSchedules.proximos)
      : null,
  });

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {error && metrics ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <DashboardPageIntro
        userName={session?.user?.name}
        companyName={companyLabel}
      >
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
        <Button
          type="button"
          variant="outline"
          className="min-h-11 gap-2 rounded-xl sm:min-h-9"
          onClick={handleExportCsv}
          aria-label="Exportar resumen del dashboard en CSV"
        >
          <FileDown className="h-4 w-4" aria-hidden />
          Exportar CSV
        </Button>
      </DashboardPageIntro>

      <DashboardOnboardingHelp
        checklist={onboardingChecklist}
        needsCompanyContext={needsCompanyContext}
        canDismiss={permissions.can(PERMISSIONS.company.manage)}
        isDismissing={isDismissingChecklist}
        onDismiss={handleDismissOnboardingChecklist}
      />

      <DashboardNeedsAttention items={attentionItems} />

      <section aria-label="Desempeño del negocio" className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Desempeño
        </h2>
        <TripledMotionDiv
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
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
      </section>

      <div className={loading ? 'pointer-events-none opacity-60' : ''}>
        <DashboardCharts
          revenueByMonth={metrics.revenueByMonth}
          paymentStatusBreakdown={metrics.paymentStatusBreakdown}
          revenueMonthCount={monthCount}
        />
      </div>

      <section aria-label="Actividad reciente" className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Actividad
        </h2>
        <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
          <DashboardServiceSchedulesWidget
            canRead={urgentSchedules.canRead}
            missingCompany={urgentSchedules.missingCompany}
            permissionsLoading={urgentSchedules.permissionsLoading}
            loading={urgentSchedules.loading}
            error={urgentSchedules.error}
            proximos={urgentSchedules.proximos}
            atrasados={urgentSchedules.atrasados}
            onRetry={urgentSchedules.reload}
          />
          <div className="min-w-0 lg:col-span-2 only:lg:col-span-3">
            <DashboardActivityFeed />
          </div>
        </div>
      </section>

      <DashboardQuickActions />
    </div>
  );
};
