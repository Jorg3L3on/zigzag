'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Ticket,
  DollarSign,
  Wallet,
  ClipboardList,
} from 'lucide-react';
import { TripledMotionDiv, tripledStagger } from '@/components/tripled';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { DashboardKpiCard } from '@/components/dashboard/dashboard-kpi-card';
import { DashboardRecentTickets } from '@/components/dashboard/dashboard-recent-tickets';
import type { DashboardKpiKey } from '@/lib/dashboard-kpi';
import { useCompany } from '@/contexts/company-context';
import {
  fetchDashboardMetrics,
  type DashboardMetrics,
} from '@/actions/dashboard';
import type { DashboardMonthCount } from '@/lib/dashboard-metrics';
import { getErrorDisplayMessage } from '@/lib/network-awareness';

const MONTH_PRESETS: { value: DashboardMonthCount; label: string }[] = [
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
  const [monthCount, setMonthCount] = React.useState<DashboardMonthCount>(12);
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
      <p className="text-muted-foreground" role="alert">
        {error}
      </p>
    );
  }

  if (!metrics) {
    return null;
  }

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
        {MONTH_PRESETS.map((p) => (
          <Button
            key={p.value}
            type="button"
            variant={monthCount === p.value ? 'default' : 'outline'}
            className="min-h-11 min-w-[5.5rem] rounded-xl sm:min-h-9"
            onClick={() => setMonthCount(p.value)}
            aria-pressed={monthCount === p.value}
            aria-label={`Mostrar ingresos de ${p.label}`}
          >
            {p.label}
          </Button>
        ))}
      </div>

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

      <DashboardRecentTickets tickets={metrics.recentTickets} />
    </div>
  );
};
