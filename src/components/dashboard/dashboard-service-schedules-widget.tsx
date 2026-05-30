'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [proximos, setProximos] = React.useState<ClientServiceScheduleListItem[]>(
    [],
  );
  const [atrasados, setAtrasados] = React.useState<ClientServiceScheduleListItem[]>(
    [],
  );

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const companyId = selectedCompany?.id ?? null;

      const [proximosRes, atrasadosRes] = await Promise.all([
        listClientServiceSchedules({ companyId, filter: 'proximos' }),
        listClientServiceSchedules({ companyId, filter: 'atrasados' }),
      ]);

      if (cancelled) {
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
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [selectedCompany?.id]);

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
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground" role="alert">
            {error}
          </p>
        ) : urgentRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay recordatorios urgentes.
          </p>
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
        {!loading && !error ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {atrasados.length} atrasados · {proximos.length} próximos
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};
