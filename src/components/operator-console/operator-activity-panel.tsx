'use client';

import Link from 'next/link';
import React from 'react';
import { useCompany } from '@/contexts/company-context';
import { TripledEmptyState, TripledMobileRecordCard } from '@/components/tripled';
import { FormattedDate } from '@/components/formatted-date';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_RESULTS,
} from '@/lib/audit-catalog';
import {
  formatAuditResourceLabel,
  resolveAuditResourceLink,
} from '@/lib/audit-display';
import {
  isOperatorIncidentEvent,
  operatorIncidentLabel,
} from '@/lib/operator-audit-incidents';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { ClipboardList, Loader2 } from 'lucide-react';

type AuditEventRow = {
  id: number;
  occurred_at: string;
  actor_user_id: string | null;
  resource_type: string;
  resource_id: string | null;
  action: string;
  result: string;
};

const AuditResourceLink = ({ event }: { event: AuditEventRow }) => {
  const link = resolveAuditResourceLink(event.resource_type, event.resource_id);
  const label = formatAuditResourceLabel(event.resource_type, event.resource_id);

  if (!link) {
    return <span>{label}</span>;
  }

  return (
    <Link
      href={link.href}
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {link.label}
    </Link>
  );
};

export const OperatorActivityPanel = () => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const isSystemTenant = selectedCompany?.is_system === true;

  const [events, setEvents] = React.useState<AuditEventRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [resourceType, setResourceType] = React.useState('all');
  const [actionFilter, setActionFilter] = React.useState('all');
  const [resultFilter, setResultFilter] = React.useState('all');
  const [incidentsOnly, setIncidentsOnly] = React.useState(false);

  React.useEffect(() => {
    if (!companyId || isSystemTenant) {
      setEvents([]);
      setLoadError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        params.set('target_company_id', String(companyId));
        params.set('limit', '25');
        if (resourceType !== 'all') {
          params.set('resource_type', resourceType);
        }
        if (actionFilter !== 'all') {
          params.set('action', actionFilter);
        }
        if (resultFilter !== 'all') {
          params.set('result', resultFilter);
        }

        const response = await fetch(`/api/audit/events?${params.toString()}`);
        const payload = await response.json();
        if (cancelled) {
          return;
        }
        if (!response.ok || !payload.success) {
          const errorType = classifyClientError(
            null,
            response.status,
            payload?.errorType,
          );
          setLoadError(
            getErrorMessageByType(
              errorType,
              payload?.error || 'No se pudo cargar la actividad reciente',
            ),
          );
          setEvents([]);
          return;
        }

        const items = (payload.data?.items ?? []) as AuditEventRow[];
        setEvents(
          incidentsOnly
            ? items.filter((row) => isOperatorIncidentEvent(row))
            : items,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLoadError(
          getErrorMessageByType(
            classifyClientError(error),
            'No se pudo cargar la actividad reciente',
          ),
        );
        setEvents([]);
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
  }, [
    companyId,
    isSystemTenant,
    resourceType,
    actionFilter,
    resultFilter,
    incidentsOnly,
  ]);

  if (!companyId) {
    return null;
  }

  if (isSystemTenant) {
    return null;
  }

  const incidentCount = events.filter((row) => isOperatorIncidentEvent(row)).length;

  return (
    <section className="space-y-4 border-t border-border/60 pt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Actividad reciente
          </h2>
          <p className="text-sm text-muted-foreground">
            Eventos de auditoría para la empresa seleccionada.
          </p>
        </div>
        {incidentCount > 0 ? (
          <Badge variant="destructive">
            {incidentCount} incidente{incidentCount === 1 ? '' : 's'} operativo
            {incidentCount === 1 ? '' : 's'}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger aria-label="Filtrar por tipo de recurso">
            <SelectValue placeholder="Recurso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los recursos</SelectItem>
            {AUDIT_RESOURCE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger aria-label="Filtrar por acción">
            <SelectValue placeholder="Acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            {AUDIT_ACTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger aria-label="Filtrar por resultado">
            <SelectValue placeholder="Resultado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los resultados</SelectItem>
            {AUDIT_RESULTS.map((result) => (
              <SelectItem key={result} value={result}>
                {result}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={incidentsOnly ? 'default' : 'outline'}
          className="min-h-11 rounded-xl"
          onClick={() => setIncidentsOnly((current) => !current)}
          aria-pressed={incidentsOnly}
        >
          Solo incidentes
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : events.length === 0 ? (
        <TripledEmptyState
          icon={<ClipboardList className="h-4 w-4" aria-hidden />}
          title="Sin actividad"
          description="No hay eventos de auditoría con los filtros actuales."
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {events.map((event) => {
              const incident = isOperatorIncidentEvent(event);
              return (
                <TripledMobileRecordCard key={event.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={incident ? 'destructive' : 'secondary'}>
                      {event.result}
                    </Badge>
                    <Badge variant="outline">{event.action}</Badge>
                    {incident ? (
                      <Badge variant="destructive">
                        {operatorIncidentLabel(event)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm">
                    <AuditResourceLink event={event} />
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Actor: {event.actor_user_id ?? '—'} ·{' '}
                    <FormattedDate date={new Date(event.occurred_at)} />
                  </p>
                </TripledMobileRecordCard>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border/70 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Incidente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const incident = isOperatorIncidentEvent(event);
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        <FormattedDate date={new Date(event.occurred_at)} />
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {event.actor_user_id ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        <AuditResourceLink event={event} />
                      </TableCell>
                      <TableCell>{event.action}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            event.result === 'success' ? 'default' : 'destructive'
                          }
                        >
                          {event.result}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {incident ? (
                          <Badge variant="destructive">
                            {operatorIncidentLabel(event)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
};
