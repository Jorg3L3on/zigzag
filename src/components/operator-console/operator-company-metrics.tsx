'use client';

import React from 'react';
import {
  fetchDashboardMetrics,
  type DashboardMetrics,
} from '@/actions/dashboard';
import { fetchOperatorUserSessions } from '@/actions/operator-user-sessions';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { DashboardKpiCard } from '@/components/dashboard/dashboard-kpi-card';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
import {
  TripledEmptyState,
  TripledMotionDiv,
  tripledStagger,
} from '@/components/tripled';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCompany } from '@/contexts/company-context';
import type { DashboardKpiKey } from '@/lib/dashboard-kpi';
import { formatRelativeActivityTime } from '@/lib/format-relative-time';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import type { OperatorUserSessionRow } from '@/lib/operator-user-sessions';
import { cn } from '@/lib/utils';
import {
  ClipboardList,
  DollarSign,
  Loader2,
  Ticket,
  Users,
  Wallet,
} from 'lucide-react';

const KPI_ICONS: Record<DashboardKpiKey, React.ReactNode> = {
  revenue: <DollarSign className="h-4 w-4" aria-hidden />,
  cashCollected: <Wallet className="h-4 w-4" aria-hidden />,
  outstandingBalance: <ClipboardList className="h-4 w-4" aria-hidden />,
  activeTickets: <Ticket className="h-4 w-4" aria-hidden />,
};

/** Viewport for ~4 user rows + gaps (space-y-3). */
const USER_LIST_SCROLL_CLASS =
  'max-h-[calc(4.5rem*4+0.75rem*3)] overflow-y-auto pr-1';

export const OperatorCompanyMetrics = () => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const isSystemTenant = selectedCompany?.is_system === true;

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [metrics, setMetrics] = React.useState<DashboardMetrics | null>(null);
  const [users, setUsers] = React.useState<OperatorUserSessionRow[]>([]);
  const [usersError, setUsersError] = React.useState<string | null>(null);
  const [usersLoading, setUsersLoading] = React.useState(false);

  React.useEffect(() => {
    if (!companyId || isSystemTenant) {
      setLoading(false);
      setError(null);
      setMetrics(null);
      setUsers([]);
      setUsersError(null);
      setUsersLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setUsersLoading(true);
    setError(null);
    setUsersError(null);
    setMetrics(null);
    setUsers([]);

    const load = async () => {
      try {
        const [dashboardResult, sessionsResult] = await Promise.all([
          fetchDashboardMetrics({ companyId }),
          fetchOperatorUserSessions(companyId),
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
        } else {
          setMetrics(dashboardResult.data);
        }

        if (!sessionsResult.success || !sessionsResult.data) {
          const errorType = classifyClientError(
            null,
            undefined,
            sessionsResult.errorType,
          );
          setUsersError(
            getErrorMessageByType(
              errorType,
              sessionsResult.error ||
                'No se pudieron cargar los usuarios',
            ),
          );
          setUsers([]);
        } else {
          setUsers(sessionsResult.data);
        }
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
        setUsersError(
          getErrorMessageByType(
            classifyClientError(loadError),
            'No se pudieron cargar los usuarios',
          ),
        );
        setUsers([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setUsersLoading(false);
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
    <section className="space-y-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Resumen</h2>
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
        <div className="space-y-6">
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

          <DashboardCharts
            revenueByMonth={metrics.revenueByMonth}
            paymentStatusBreakdown={metrics.paymentStatusBreakdown}
          />
        </div>
      )}

      <Card className={cn(DASHBOARD_CARD_CLASS)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Usuarios</CardTitle>
          <CardDescription>
            Último inicio de sesión en {selectedCompany?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : usersError ? (
            <p className="text-sm text-destructive" role="alert">
              {usersError}
            </p>
          ) : users.length === 0 ? (
            <TripledEmptyState
              icon={<Users className="h-4 w-4" aria-hidden />}
              title="Sin usuarios"
              description="No hay usuarios asignados a esta empresa."
            />
          ) : (
            <ul
              className={cn('space-y-3', USER_LIST_SCROLL_CLASS)}
              aria-label="Usuarios de la empresa"
            >
              {users.map((userRow) => (
                <li
                  key={userRow.id}
                  className="flex min-h-[4.5rem] items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{userRow.name}</p>
                    <p className="truncate text-muted-foreground">
                      {userRow.email}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {userRow.lastSignedInAt
                      ? formatRelativeActivityTime(userRow.lastSignedInAt)
                      : 'Sin inicio de sesión'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
};
