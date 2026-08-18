'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
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
import { TripledEmptyState } from '@/components/tripled';
import { DashboardActivityFeed } from '@/components/dashboard/dashboard-activity-feed';
import { DashboardKpiCard } from '@/components/dashboard/dashboard-kpi-card';
import { DashboardNeedsAttention } from '@/components/dashboard/dashboard-needs-attention';
import { DashboardPlatformHome } from '@/components/dashboard/dashboard-platform-home';
import { DashboardQuickActions } from '@/components/dashboard/dashboard-quick-actions';
import { DashboardServiceSchedulesWidget } from '@/components/dashboard/dashboard-service-schedules-widget';
import { DashboardTechnicianDayWidget } from '@/components/dashboard/dashboard-technician-day-widget';
import { useTechnicianDayQueue } from '@/hooks/use-technician-day-queue';
import {
  buildDashboardAttentionItems,
  countSchedulesDueToday,
} from '@/lib/dashboard-attention';
import { buildDashboardComposition } from '@/lib/dashboard-composition';
import { getExpiredLoginPath } from '@/lib/login-redirect';
import { resolveDashboardPersona } from '@/lib/dashboard-persona';
import type { DashboardKpiKey } from '@/lib/dashboard-kpi';
import { useCompany } from '@/contexts/company-context';
import {
  fetchDashboardMetrics,
  type DashboardMetrics,
} from '@/actions/dashboard';
import type { DashboardMonthCount } from '@/lib/dashboard-metrics';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { useDashboardUrgentSchedules } from '@/hooks/use-dashboard-urgent-schedules';
import { useDeferredMount } from '@/hooks/use-deferred-mount';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

const DashboardCharts = dynamic(
  () =>
    import('@/components/dashboard/dashboard-charts').then((module) => ({
      default: module.DashboardCharts,
    })),
  {
    loading: () => <Skeleton className="h-[280px] rounded-xl lg:col-span-2" />,
    ssr: false,
  },
);

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

export type DashboardMetricsClientProps = {
  initialMetrics?: DashboardMetrics | null;
  userName?: string | null;
};

export const DashboardMetricsClient = ({
  initialMetrics = null,
  userName = null,
}: DashboardMetricsClientProps) => {
  const router = useRouter();
  const { status, data: session } = useSession();
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const deferSecondaryWidgets = useDeferredMount();
  const urgentSchedules = useDashboardUrgentSchedules(deferSecondaryWidgets);
  const technicianDay = useTechnicianDayQueue(deferSecondaryWidgets);
  const [monthCount, setMonthCount] = React.useState<DashboardMonthCount>(1);
  const [metrics, setMetrics] = React.useState<DashboardMetrics | null>(
    initialMetrics,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(initialMetrics == null);

  React.useEffect(() => {
    if (status === 'loading') {
      return;
    }
    if (!session?.user?.company_id) {
      const callbackPath =
        typeof window === 'undefined'
          ? undefined
          : `${window.location.pathname}${window.location.search}`;
      router.replace(getExpiredLoginPath(callbackPath));
      return;
    }

    const isSystem = session.user.company_is_system;
    const viewingSystemHome =
      isSystem &&
      (selectedCompany == null || selectedCompany.is_system === true);

    // Platform home does not load tenant metrics.
    if (viewingSystemHome) {
      setLoading(false);
      setMetrics(null);
      setError(null);
      return;
    }

    if (
      initialMetrics != null &&
      monthCount === 1 &&
      !isSystem &&
      selectedCompany == null
    ) {
      setLoading(false);
      setMetrics(initialMetrics);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const companyIdArg = isSystem
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
  }, [status, session, selectedCompany, monthCount, router, initialMetrics]);

  const needsCompanyContext =
    session?.user.company_is_system === true &&
    (selectedCompany == null || selectedCompany.is_system === true);

  const persona = resolveDashboardPersona({
    isSystem: Boolean(
      session?.user.company_is_system || permissions.isSystem,
    ),
    needsCompanyContext,
    can: permissions.can,
  });
  const composition = buildDashboardComposition(persona);

  if (
    (status === 'loading' && initialMetrics == null && !userName) ||
    (permissions.loading && initialMetrics == null && !userName)
  ) {
    return <DashboardLoadingSkeleton />;
  }

  // System platform home does not need tenant metrics.
  if (persona === 'system') {
    return (
      <div className="flex flex-col gap-6 md:gap-8">
        {composition.widgets.map((widgetId) => {
          if (widgetId === 'platformHome') {
            return <DashboardPlatformHome key={widgetId} />;
          }
          return null;
        })}
      </div>
    );
  }

  if (loading && !metrics && !error) {
    if (userName || initialMetrics) {
      return null;
    }
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

  const visibleKpis =
    composition.kpiKeys === 'all'
      ? metrics.kpis
      : metrics.kpis.filter((kpi) => composition.kpiKeys.includes(kpi.key));

  const exportControls = composition.showExports ? (
    <>
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
        <FileDown className="h-4 w-4" aria-hidden data-icon="inline-start" />
        Exportar PDF
      </Button>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 gap-2 rounded-xl sm:min-h-9"
        onClick={handleExportCsv}
        aria-label="Exportar resumen del dashboard en CSV"
      >
        <FileDown className="h-4 w-4" aria-hidden data-icon="inline-start" />
        Exportar CSV
      </Button>
    </>
  ) : null;

  const renderWidget = (widgetId: (typeof composition.widgets)[number]) => {
    switch (widgetId) {
      case 'needsAttention':
        return (
          <DashboardNeedsAttention
            key={widgetId}
            items={attentionItems}
            emptyTitle={composition.emptyCopy.attentionTitle}
            emptyDescription={composition.emptyCopy.attentionDescription}
          />
        );
      case 'kpis':
        return (
          <section
            key={widgetId}
            aria-label={composition.sectionTitles.kpis}
            className="space-y-3"
          >
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {composition.sectionTitles.kpis}
            </h2>
            <div
              className={cn(
                'grid gap-4',
                visibleKpis.length <= 2
                  ? 'grid-cols-2 lg:grid-cols-2 lg:max-w-2xl'
                  : 'grid-cols-2 lg:grid-cols-4',
              )}
            >
              {visibleKpis.map((kpi) => {
                const card = (
                  <DashboardKpiCard
                    key={kpi.key}
                    kpi={kpi}
                    icon={KPI_ICONS[kpi.key]}
                  />
                );
                if (kpi.key !== 'outstandingBalance') {
                  return card;
                }
                return (
                  <Link
                    key={kpi.key}
                    href="/cobranza"
                    className="block h-full min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Ver cobranza: saldo por cobrar"
                  >
                    <DashboardKpiCard kpi={kpi} icon={KPI_ICONS[kpi.key]} />
                  </Link>
                );
              })}
            </div>
          </section>
        );
      case 'charts':
        if (!deferSecondaryWidgets) {
          return (
            <Skeleton
              key={widgetId}
              className="h-[280px] rounded-xl lg:col-span-2"
            />
          );
        }
        return (
          <div
            key={widgetId}
            className={loading ? 'pointer-events-none opacity-60' : ''}
          >
            <DashboardCharts
              revenueByMonth={metrics.revenueByMonth}
              paymentStatusBreakdown={metrics.paymentStatusBreakdown}
              revenueMonthCount={monthCount}
            />
          </div>
        );
      case 'operations':
        if (!deferSecondaryWidgets) {
          return (
            <section
              key={widgetId}
              aria-label={composition.sectionTitles.operations}
              className="space-y-3"
            >
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {composition.sectionTitles.operations}
              </h2>
              <Skeleton className="h-64 rounded-xl" />
            </section>
          );
        }
        return (
          <section
            key={widgetId}
            aria-label={composition.sectionTitles.operations}
            className="space-y-3"
          >
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {composition.sectionTitles.operations}
            </h2>
            <div className="space-y-4">
              <DashboardTechnicianDayWidget
                canRead={technicianDay.canRead}
                missingCompany={technicianDay.missingCompany}
                permissionsLoading={technicianDay.permissionsLoading}
                loading={technicianDay.loading}
                error={technicianDay.error}
                items={technicianDay.data?.items ?? []}
                todayCount={technicianDay.data?.todayCount ?? 0}
                overdueCount={technicianDay.data?.overdueCount ?? 0}
                onRetry={technicianDay.reload}
                onPaymentApplied={() => {
                  technicianDay.reload();
                }}
              />
              <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
                <DashboardServiceSchedulesWidget
                  canRead={urgentSchedules.canRead}
                  canCreateTicket={permissions.can(PERMISSIONS.tickets.write)}
                  missingCompany={urgentSchedules.missingCompany}
                  permissionsLoading={urgentSchedules.permissionsLoading}
                  loading={urgentSchedules.loading}
                  error={urgentSchedules.error}
                  proximos={urgentSchedules.proximos}
                  atrasados={urgentSchedules.atrasados}
                  onRetry={urgentSchedules.reload}
                />
                <div className="min-w-0 lg:col-span-2 only:lg:col-span-3">
                  <DashboardActivityFeed
                    emptyTitle={composition.emptyCopy.activityTitle}
                    emptyDescription={composition.emptyCopy.activityDescription}
                  />
                </div>
              </div>
            </div>
          </section>
        );
      case 'quickActions':
        if (!composition.showQuickActions) {
          return null;
        }
        return (
          <DashboardQuickActions key={widgetId} persona={persona} />
        );
      default:
        return null;
    }
  };

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

      {exportControls ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {exportControls}
        </div>
      ) : null}

      {composition.widgets.map((widgetId) => renderWidget(widgetId))}
    </div>
  );
};

export default DashboardMetricsClient;
