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
  AlertTriangle,
} from 'lucide-react';
import { TripledEmptyState } from '@/components/tripled';
import { DashboardActivityFeed } from '@/components/dashboard/dashboard-activity-feed';
import { DashboardKpiCard } from '@/components/dashboard/dashboard-kpi-card';
import { DashboardPlatformHome } from '@/components/dashboard/dashboard-platform-home';
import { DashboardQuickActions } from '@/components/dashboard/dashboard-quick-actions';
import { DashboardTuDia } from '@/components/dashboard/dashboard-tu-dia';
import {
  buildCampoDashboardComposition,
  buildDashboardComposition,
} from '@/lib/dashboard-composition';
import type { ExperienceMode } from '@/lib/experience-mode';
import { getExpiredLoginPath } from '@/lib/login-redirect';
import { resolveDashboardPersona } from '@/lib/dashboard-persona';
import type { DashboardKpiKey } from '@/lib/dashboard-kpi';
import { useCompany } from '@/contexts/company-context';
import {
  fetchDashboardMetrics,
  type DashboardMetrics,
} from '@/actions/dashboard';
import type { DashboardDayQueue } from '@/lib/dashboard-day-queue';
import type { DashboardMonthCount } from '@/lib/dashboard-metrics';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { useDeferredMount } from '@/hooks/use-deferred-mount';
import { usePermissions } from '@/hooks/use-permissions';
import { formatTicketListAmount } from '@/lib/ticket-payment-status';
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
  /** Tu día counts and rows loaded with the page (tenant users). */
  initialDayQueue?: DashboardDayQueue | null;
  userName?: string | null;
  initialExperienceMode?: ExperienceMode;
};

export const DashboardMetricsClient = ({
  initialMetrics = null,
  initialDayQueue = null,
  userName = null,
  initialExperienceMode = 'office',
}: DashboardMetricsClientProps) => {
  const router = useRouter();
  const { status, data: session } = useSession();
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const deferSecondaryWidgets = useDeferredMount();
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
  const composition =
    initialExperienceMode === 'campo'
      ? buildCampoDashboardComposition(persona)
      : buildDashboardComposition(persona);

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

  const visibleKpis =
    composition.kpiKeys === 'all'
      ? metrics.kpis
      : metrics.kpis.filter((kpi) => composition.kpiKeys.includes(kpi.key));

  const periodSelect = composition.showPeriodSelect ? (
    <Select
      value={String(monthCount)}
      onValueChange={(value) =>
        setMonthCount(Number(value) as DashboardMonthCount)
      }
    >
      <SelectTrigger
        className="min-h-11 w-[140px] rounded-xl sm:min-h-9"
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
  ) : null;

  const kpiValue = (key: DashboardKpiKey) =>
    metrics.kpis.find((kpi) => kpi.key === key)?.value ?? 0;
  const campoChips = composition.campoOperations ? (
    <>
      <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 text-xs sm:min-h-9">
        <span className="text-muted-foreground">Entró hoy</span>
        <span className="font-semibold tabular-nums">
          {formatTicketListAmount(kpiValue('cashCollected'))}
        </span>
      </span>
      <Link
        href="/cobranza"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 text-xs sm:min-h-9 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Ver cobranza: por cobrar"
      >
        <span className="text-muted-foreground">Por cobrar</span>
        <span className="font-semibold tabular-nums">
          {formatTicketListAmount(kpiValue('outstandingBalance'))}
        </span>
      </Link>
    </>
  ) : null;

  const renderWidget = (widgetId: (typeof composition.widgets)[number]) => {
    switch (widgetId) {
      case 'tuDia':
        return (
          <DashboardTuDia
            key={widgetId}
            initialQueue={initialDayQueue}
            campo={composition.campoOperations}
            headerExtra={campoChips}
            className={
              composition.widgets.includes('activity')
                ? 'xl:col-span-2 xl:self-start'
                : 'xl:col-span-3'
            }
          />
        );
      case 'activity':
        // Below xl: after Desempeño. Wide screens: beside Tu día.
        return (
          <div
            key={widgetId}
            className="order-last min-w-0 xl:order-none xl:col-span-1"
          >
            {deferSecondaryWidgets ? (
              <DashboardActivityFeed
                emptyTitle={composition.emptyCopy.activityTitle}
                emptyDescription={composition.emptyCopy.activityDescription}
              />
            ) : (
              <Skeleton className="h-64 rounded-xl" />
            )}
          </div>
        );
      case 'kpis':
        return (
          <section
            key={widgetId}
            aria-label={composition.sectionTitles.kpis}
            className="space-y-3 xl:col-span-3"
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
              className="h-[280px] rounded-xl xl:col-span-3"
            />
          );
        }
        return (
          <div
            key={widgetId}
            className={cn(
              'xl:col-span-3',
              loading && 'pointer-events-none opacity-60',
            )}
          >
            <DashboardCharts
              revenueByMonth={metrics.revenueByMonth}
              paymentStatusBreakdown={metrics.paymentStatusBreakdown}
              revenueMonthCount={monthCount}
              revenuePeriodControl={periodSelect}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:gap-8 xl:grid-cols-3">
      {error && metrics ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive xl:col-span-3"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {composition.showQuickActions ? (
        <div className="min-w-0 xl:col-span-3">
          <DashboardQuickActions persona={persona} />
        </div>
      ) : null}

      {composition.widgets.map((widgetId) => renderWidget(widgetId))}
    </div>
  );
};

export default DashboardMetricsClient;
