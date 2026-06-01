'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  listClientServiceSchedules,
  type ClientServiceScheduleListItem,
} from '@/actions/client-service-schedules';
import { useCompany } from '@/contexts/company-context';
import { FormattedDate } from '@/components/formatted-date';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { usePermissions } from '@/hooks/use-permissions';
import {
  canReadServiceSchedules,
  needsSelectedCompanyForSchedules,
} from '@/lib/service-schedules-rbac';
import { TripledEmptyState } from '@/components/tripled';

const mergeUrgent = (
  proximos: ClientServiceScheduleListItem[],
  atrasados: ClientServiceScheduleListItem[],
  limit = 6,
): ClientServiceScheduleListItem[] => {
  const seen = new Set<number>();
  const merged: ClientServiceScheduleListItem[] = [];

  for (const item of [...atrasados, ...proximos]) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    merged.push(item);
    if (merged.length >= limit) {
      break;
    }
  }

  return merged;
};

export const DashboardServiceSchedulesWidget = () => {
  const { selectedCompany } = useCompany();
  const { can, isSystem, loading: permissionsLoading } = usePermissions();
  const canRead = canReadServiceSchedules(can);
  const missingCompany = needsSelectedCompanyForSchedules(
    isSystem,
    selectedCompany?.id,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [proximos, setProximos] = React.useState<ClientServiceScheduleListItem[]>(
    [],
  );
  const [atrasados, setAtrasados] = React.useState<ClientServiceScheduleListItem[]>(
    [],
  );
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSchedules = React.useCallback(async () => {
    if (permissionsLoading) {
      return;
    }

    if (!canRead) {
      setLoading(false);
      setError(null);
      setProximos([]);
      setAtrasados([]);
      return;
    }

    if (missingCompany) {
      setLoading(false);
      setError(null);
      setProximos([]);
      setAtrasados([]);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);
    const companyId = selectedCompany?.id ?? null;

    const [proximosRes, atrasadosRes] = await Promise.all([
      listClientServiceSchedules({ companyId, filter: 'proximos' }),
      listClientServiceSchedules({ companyId, filter: 'atrasados' }),
    ]);

    if (!mountedRef.current) {
      return;
    }

    setLoading(false);

    if (!proximosRes.success || !atrasadosRes.success) {
      setError(
        getErrorDisplayMessage(
          proximosRes.success ? atrasadosRes : proximosRes,
          'No se pudieron cargar los recordatorios',
        ),
      );
      return;
    }

    setProximos(proximosRes.data ?? []);
    setAtrasados(atrasadosRes.data ?? []);
  }, [
    canRead,
    missingCompany,
    permissionsLoading,
    selectedCompany?.id,
  ]);

  React.useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  if (permissionsLoading) {
    return null;
  }

  if (!canRead) {
    return null;
  }

  const urgentRows = mergeUrgent(proximos, atrasados);

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">Recordatorios de servicio</CardTitle>
          <CardDescription>
            Próximos 14 días y atrasados
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 rounded-lg" asChild>
          <Link href="/dashboard/service-schedules">Ver todos</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {missingCompany ? (
          <TripledEmptyState
            icon={<CalendarClock className="h-4 w-4" />}
            title="Selecciona una empresa"
            description="Selecciona una empresa para ver recordatorios."
          />
        ) : loading ? (
          <div
            className="space-y-3"
            role="status"
            aria-label="Cargando recordatorios de servicio"
          >
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-4/5 rounded-lg" />
          </div>
        ) : error ? (
          <TripledEmptyState
            icon={<CalendarClock className="h-4 w-4" />}
            title="Error al cargar"
            description={error}
            role="alert"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadSchedules()}
              >
                Reintentar
              </Button>
            }
          />
        ) : urgentRows.length === 0 ? (
          <TripledEmptyState
            icon={<CalendarClock className="h-4 w-4" />}
            title="Sin urgentes"
            description="No hay recordatorios urgentes."
          />
        ) : (
          <ul className="space-y-3">
            {urgentRows.map((row) => (
              <li
                key={row.id}
                className="flex items-start justify-between gap-2 border-b border-border/50 pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.clientName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.serviceName}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge
                    variant={
                      row.bucket === 'atrasados' ? 'destructive' : 'secondary'
                    }
                  >
                    {row.bucket === 'atrasados' ? 'Atrasado' : 'Próximo'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    <FormattedDate date={new Date(row.nextDueAt)} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!missingCompany && !loading && !error ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {atrasados.length} atrasados · {proximos.length} próximos
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};
