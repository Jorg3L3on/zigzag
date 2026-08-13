'use client';

import React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useCompany } from '@/contexts/company-context';
import {
  TripledDataPanel,
  TripledEmptyState,
  TripledMobileRecordCard,
} from '@/components/tripled';
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createOperatorActivityColumns } from '@/components/operator-console/operator-activity-columns';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_RESULTS,
} from '@/lib/audit-catalog';
import {
  formatAuditActionLabel,
  formatAuditResourceTypeLabel,
  formatAuditResultLabel,
} from '@/lib/audit-labels';
import {
  formatAuditResourceLabel,
  redactAuditDisplayValue,
  resolveAuditResourceLink,
} from '@/lib/audit-display';
import {
  groupOperatorActivityEvents,
  type OperatorActivityRow,
} from '@/lib/operator-activity';
import {
  isOperatorIncidentEvent,
  operatorIncidentLabel,
} from '@/lib/operator-audit-incidents';
import { actorDisplayName } from '@/lib/audit-actor-display';
import type { AuditEventListItem } from '@/lib/audit-query';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { resolveResourceListState } from '@/lib/resource-list-state';
import Link from 'next/link';
import { ChevronDown, ClipboardList, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type AuditEventRow = AuditEventListItem;

const PAGE_SIZE = 25;
const DEFAULT_SORTING: SortingState = [{ id: 'occurred_at', desc: true }];
/** Viewport for ~10 body rows + header (h-12 + ~3.25rem rows). */
const ACTIVITY_TABLE_SCROLL_CLASS =
  'max-h-[calc(3rem+3.25rem*10)] overflow-y-auto';

const AuditJsonBlock = ({
  title,
  value,
}: {
  title: string;
  value: Record<string, unknown> | null;
}) => (
  <section className="space-y-2">
    <h4 className="text-sm font-medium">{title}</h4>
    <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
      {JSON.stringify(redactAuditDisplayValue(value ?? {}), null, 2)}
    </pre>
  </section>
);

const AuditResourceLink = ({ event }: { event: AuditEventRow }) => {
  const link = resolveAuditResourceLink(event.resource_type, event.resource_id);
  const label = formatAuditResourceLabel(event.resource_type, event.resource_id, {
    actorName: event.actor_name,
  });

  if (!link) {
    return <span>{label}</span>;
  }

  return (
    <Link
      href={link.href}
      className="font-medium text-primary underline-offset-4 hover:underline"
      onClick={(clickEvent) => clickEvent.stopPropagation()}
    >
      {link.label}
    </Link>
  );
};

const ResultBadge = ({
  event,
}: {
  event: Pick<AuditEventRow, 'action' | 'result' | 'resource_type' | 'payload'>;
}) => {
  const incident = isOperatorIncidentEvent(event);
  if (incident) {
    return <Badge variant="destructive">{operatorIncidentLabel(event)}</Badge>;
  }
  return (
    <Badge variant={event.result === 'success' ? 'default' : 'secondary'}>
      {formatAuditResultLabel(event.result)}
    </Badge>
  );
};

export const OperatorActivityPanel = () => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const isSystemTenant = selectedCompany?.is_system === true;

  const [events, setEvents] = React.useState<AuditEventRow[]>([]);
  const [nextCursor, setNextCursor] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [resourceType, setResourceType] = React.useState('all');
  const [actionFilter, setActionFilter] = React.useState('all');
  const [resultFilter, setResultFilter] = React.useState('all');
  const [incidentsOnly, setIncidentsOnly] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [sorting, setSorting] = React.useState<SortingState>(DEFAULT_SORTING);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  React.useEffect(() => {
    if (!companyId || isSystemTenant) {
      setEvents([]);
      setNextCursor(null);
      setLoadError(null);
      setExpandedId(null);
      return;
    }

    let cancelled = false;
    setExpandedId(null);
    setLoading(true);
    setLoadError(null);

    const params = new URLSearchParams();
    params.set('target_company_id', String(companyId));
    params.set('limit', String(PAGE_SIZE));
    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    }
    if (resourceType !== 'all') {
      params.set('resource_type', resourceType);
    }
    if (actionFilter !== 'all') {
      params.set('action', actionFilter);
    }
    if (resultFilter !== 'all') {
      params.set('result', resultFilter);
    }
    if (incidentsOnly) {
      params.set('incidents_only', '1');
    }

    const load = async () => {
      try {
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
          setNextCursor(null);
          return;
        }

        setEvents((payload.data?.items ?? []) as AuditEventRow[]);
        setNextCursor(payload.data?.nextCursor ?? null);
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
        setNextCursor(null);
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
    debouncedSearch,
    resourceType,
    actionFilter,
    resultFilter,
    incidentsOnly,
    reloadToken,
  ]);

  const handleToggleExpand = React.useCallback((eventId: number) => {
    setExpandedId((current) => (current === eventId ? null : eventId));
  }, []);

  const handleRetry = () => {
    setReloadToken((token) => token + 1);
  };

  const handleLoadMore = async () => {
    if (!companyId || nextCursor == null || loadingMore) {
      return;
    }

    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set('target_company_id', String(companyId));
      params.set('limit', String(PAGE_SIZE));
      params.set('cursor', String(nextCursor));
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      if (resourceType !== 'all') {
        params.set('resource_type', resourceType);
      }
      if (actionFilter !== 'all') {
        params.set('action', actionFilter);
      }
      if (resultFilter !== 'all') {
        params.set('result', resultFilter);
      }
      if (incidentsOnly) {
        params.set('incidents_only', '1');
      }

      const response = await fetch(`/api/audit/events?${params.toString()}`);
      const payload = await response.json();
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
        return;
      }

      const items = (payload.data?.items ?? []) as AuditEventRow[];
      setEvents((current) => [...current, ...items]);
      setNextCursor(payload.data?.nextCursor ?? null);
    } catch (error) {
      setLoadError(
        getErrorMessageByType(
          classifyClientError(error),
          'No se pudo cargar la actividad reciente',
        ),
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const groupedEvents = React.useMemo(
    () => groupOperatorActivityEvents(events),
    [events],
  );
  const hasIncidents = events.some((row) => isOperatorIncidentEvent(row));
  const incidentCount = events.filter((row) =>
    isOperatorIncidentEvent(row),
  ).length;
  const hasActiveFilters =
    debouncedSearch !== '' ||
    resourceType !== 'all' ||
    actionFilter !== 'all' ||
    resultFilter !== 'all' ||
    incidentsOnly;

  const columns = React.useMemo(
    () =>
      createOperatorActivityColumns({
        expandedId,
        onToggleExpand: handleToggleExpand,
        showIncidentColumn: hasIncidents,
      }),
    [expandedId, handleToggleExpand, hasIncidents],
  );

  const table = useReactTable({
    data: groupedEvents,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.eventIds.join('-'),
  });

  if (!companyId || isSystemTenant) {
    return null;
  }

  const listState = resolveResourceListState({
    isLoading: loading,
    loadError,
    totalCount: groupedEvents.length,
    visibleCount: groupedEvents.length,
    hasActiveFilters,
  });

  const renderDetails = (event: OperatorActivityRow) => (
    <div className="grid gap-3 md:grid-cols-2">
      <AuditJsonBlock title="Carga útil" value={event.payload} />
      <AuditJsonBlock
        title="Metadatos de solicitud"
        value={event.request_meta}
      />
    </div>
  );

  return (
    <section className="space-y-4 border-t border-border/60 pt-6">
      <TripledDataPanel
        title="Actividad reciente"
        description="Eventos de auditoría para la empresa seleccionada."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        ctaSlot={
          incidentCount > 0 ? (
            <Badge variant="destructive">
              {incidentCount} incidente{incidentCount === 1 ? '' : 's'} operativo
              {incidentCount === 1 ? '' : 's'}
            </Badge>
          ) : null
        }
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={resourceType} onValueChange={setResourceType}>
              <SelectTrigger aria-label="Filtrar por tipo de recurso">
                <SelectValue placeholder="Recurso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los recursos</SelectItem>
                {AUDIT_RESOURCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatAuditResourceTypeLabel(type)}
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
                    {formatAuditActionLabel(action)}
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
                    {formatAuditResultLabel(result)}
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

          {listState.kind === 'loading' ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : listState.kind === 'error' ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive" role="alert">
                {listState.message}
              </p>
              <Button type="button" variant="outline" onClick={handleRetry}>
                Reintentar
              </Button>
            </div>
          ) : listState.kind === 'empty' || listState.kind === 'filtered-empty' ? (
            <TripledEmptyState
              icon={<ClipboardList className="h-4 w-4" aria-hidden />}
              title={
                listState.kind === 'filtered-empty'
                  ? 'Sin resultados'
                  : 'Sin actividad'
              }
              description={
                listState.kind === 'filtered-empty'
                  ? 'No hay eventos con los filtros o búsqueda actuales.'
                  : 'No hay eventos de auditoría para esta empresa.'
              }
            />
          ) : (
            <>
              <div
                className={cn('space-y-3 md:hidden', ACTIVITY_TABLE_SCROLL_CLASS)}
              >
                {table.getRowModel().rows.map((row) => {
                  const event = row.original;
                  const expanded = expandedId === event.id;
                  return (
                    <TripledMobileRecordCard key={row.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <ResultBadge event={event} />
                        <Badge variant="outline">
                          {formatAuditActionLabel(event.action)}
                        </Badge>
                        {event.count > 1 ? (
                          <Badge variant="secondary">×{event.count}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm">
                        <AuditResourceLink event={event} />
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Actor:{' '}
                        {actorDisplayName(
                          event.actor_user_id,
                          event.actor_name,
                        )}{' '}
                        ·{' '}
                        <FormattedDate
                          date={new Date(event.occurred_at)}
                          withTime
                        />
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-8 px-2"
                        onClick={() => handleToggleExpand(event.id)}
                        aria-expanded={expanded}
                        aria-label={`Ver detalle del evento ${event.id}`}
                      >
                        <ChevronDown
                          className={cn(
                            'mr-1 h-4 w-4 transition-transform',
                            expanded && 'rotate-180',
                          )}
                          aria-hidden
                        />
                        {expanded ? 'Ocultar detalle' : 'Ver detalle'}
                      </Button>
                      {expanded ? (
                        <div className="mt-3 border-t border-border/60 pt-3">
                          {renderDetails(event)}
                        </div>
                      ) : null}
                    </TripledMobileRecordCard>
                  );
                })}
              </div>

              <div
                className={cn(
                  'hidden rounded-xl border border-border/70 md:block',
                  ACTIVITY_TABLE_SCROLL_CLASS,
                )}
              >
                <table className="w-full caption-bottom text-sm">
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))] [&_tr]:border-b">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id} className="hover:bg-transparent">
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className={cn(
                              'bg-card',
                              header.id === 'expand' ? 'w-8' : undefined,
                            )}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => {
                      const event = row.original;
                      const expanded = expandedId === event.id;
                      return (
                        <React.Fragment key={row.id}>
                          <TableRow
                            className="cursor-pointer"
                            onClick={() => handleToggleExpand(event.id)}
                            onKeyDown={(keyEvent) => {
                              if (
                                keyEvent.key === 'Enter' ||
                                keyEvent.key === ' '
                              ) {
                                keyEvent.preventDefault();
                                handleToggleExpand(event.id);
                              }
                            }}
                            tabIndex={0}
                            aria-expanded={expanded}
                            aria-label={`Ver detalle del evento ${event.id}`}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell
                                key={cell.id}
                                className={
                                  cell.column.id === 'expand'
                                    ? 'w-8 px-2'
                                    : undefined
                                }
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                          {expanded ? (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={row.getVisibleCells().length}>
                                {renderDetails(event)}
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </table>
              </div>

              {nextCursor != null ? (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleLoadMore()}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cargando…
                      </>
                    ) : (
                      'Cargar más'
                    )}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </TripledDataPanel>
    </section>
  );
};
