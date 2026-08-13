'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, Download, Search } from 'lucide-react';
import Link from 'next/link';
import { getCompanies } from '@/actions/companies';
import { getUsers } from '@/actions/users';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TripledEmptyState, TripledListLoadingState } from '@/components/tripled';
import { resolveResourceListState } from '@/lib/resource-list-state';
import { FormattedDate } from '@/components/formatted-date';
import { Badge } from '@/components/ui/badge';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_RESULTS,
  formatAuditActionLabel,
  formatAuditResourceTypeLabel,
  formatAuditResultLabel,
  formatAuditSourceLabel,
} from '@/lib/audit-catalog';
import {
  createAuditColumns,
  type AuditEventRow,
} from '@/components/audit/audit-columns';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import {
  formatAuditResourceLabel,
  redactAuditDisplayValue,
  resolveAuditResourceLink,
} from '@/lib/audit-display';
import {
  formatAuditEventSummary,
  hasRequestMetaContent,
} from '@/lib/audit-event-summary';
import { cn } from '@/lib/utils';

type ActorUserOption = SearchableSelectOption & {
  companyId: number | null;
};

const formatLocalDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const daysAgoLocalDate = (days: number): string => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return formatLocalDateInput(date);
};

const AuditJsonBlock = ({
  title,
  value,
}: {
  title: string;
  value: Record<string, unknown> | null;
}) => (
  <section className="space-y-2">
    <h4 className="text-sm font-medium">{title}</h4>
    <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs">
      {JSON.stringify(redactAuditDisplayValue(value ?? {}), null, 2)}
    </pre>
  </section>
);

const AuditEventDetails = ({ event }: { event: AuditEventRow }) => {
  const [showJson, setShowJson] = React.useState(false);
  const summary = formatAuditEventSummary(event);
  const hasMeta = hasRequestMetaContent(event.request_meta);
  const route =
    typeof event.request_meta?.route === 'string'
      ? event.request_meta.route
      : null;
  const method =
    typeof event.request_meta?.method === 'string'
      ? event.request_meta.method
      : null;

  return (
    <div className="space-y-4">
      {summary.details.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-sm font-medium">Detalle</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {summary.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Metadatos de solicitud</h4>
        {hasMeta ? (
          <div className="flex flex-wrap gap-2">
            {method ? (
              <Badge variant="outline" aria-label={`Método ${method}`}>
                Método: {method}
              </Badge>
            ) : null}
            {route ? (
              <Badge variant="secondary" aria-label={`Ruta ${route}`}>
                Ruta: {route}
              </Badge>
            ) : null}
            {!method && !route ? (
              <p className="text-sm text-muted-foreground">
                Metadatos presentes (ver JSON).
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin metadatos de solicitud
          </p>
        )}
      </section>

      <div className="space-y-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowJson((current) => !current)}
          aria-expanded={showJson}
        >
          {showJson ? 'Ocultar JSON' : 'Ver JSON'}
        </Button>
        {showJson ? (
          <div className="grid gap-3 md:grid-cols-2">
            <AuditJsonBlock title="Carga útil" value={event.payload} />
            <AuditJsonBlock
              title="Metadatos de solicitud"
              value={event.request_meta}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

const AuditResourceLabel = ({ event }: { event: AuditEventRow }) => {
  const link = resolveAuditResourceLink(event.resource_type, event.resource_id);
  const label = formatAuditResourceLabel(event.resource_type, event.resource_id);

  if (!link) {
    return <>{label}</>;
  }

  return (
    <Link
      href={link.href}
      className="font-medium text-primary underline-offset-4 hover:underline"
      onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
    >
      {link.label}
    </Link>
  );
};

const buildFilterQuery = (input: {
  search: string;
  targetCompanyId: string;
  actorUserId: string;
  resourceType: string;
  resourceId: string;
  actionFilter: string;
  resultFilter: string;
  fromDate: string;
  toDate: string;
  incidentsOnly: boolean;
}): URLSearchParams => {
  const params = new URLSearchParams();
  if (input.search) {
    params.set('search', input.search);
  }
  if (input.targetCompanyId.trim()) {
    params.set('target_company_id', input.targetCompanyId.trim());
  }
  if (input.actorUserId.trim()) {
    params.set('actor_user_id', input.actorUserId.trim());
  }
  if (input.resourceType !== 'all') {
    params.set('resource_type', input.resourceType);
  }
  if (input.resourceId.trim()) {
    params.set('resource_id', input.resourceId.trim());
  }
  if (input.actionFilter !== 'all') {
    params.set('action', input.actionFilter);
  }
  if (input.resultFilter !== 'all') {
    params.set('result', input.resultFilter);
  }
  if (input.fromDate) {
    params.set('from', input.fromDate);
  }
  if (input.toDate) {
    params.set('to', input.toDate);
  }
  if (input.incidentsOnly) {
    params.set('incidents', '1');
  }
  return params;
};

export const AuditList = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [events, setEvents] = React.useState<AuditEventRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState(
    () => searchParams.get('search') ?? '',
  );
  const [debouncedSearch, setDebouncedSearch] = React.useState(
    () => searchParams.get('search')?.trim() ?? '',
  );
  const [targetCompanyId, setTargetCompanyId] = React.useState(
    () => searchParams.get('target_company_id') ?? '',
  );
  const [actorUserId, setActorUserId] = React.useState(
    () => searchParams.get('actor_user_id') ?? '',
  );
  const [resourceType, setResourceType] = React.useState<string>(
    () => searchParams.get('resource_type') ?? 'all',
  );
  const [resourceId, setResourceId] = React.useState(
    () => searchParams.get('resource_id') ?? '',
  );
  const [actionFilter, setActionFilter] = React.useState<string>(
    () => searchParams.get('action') ?? 'all',
  );
  const [resultFilter, setResultFilter] = React.useState<string>(
    () => searchParams.get('result') ?? 'all',
  );
  const [fromDate, setFromDate] = React.useState(
    () => searchParams.get('from') ?? '',
  );
  const [toDate, setToDate] = React.useState(
    () => searchParams.get('to') ?? '',
  );
  const [incidentsOnly, setIncidentsOnly] = React.useState(
    () =>
      searchParams.get('incidents') === '1' ||
      searchParams.get('incidents') === 'true',
  );
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [nextCursor, setNextCursor] = React.useState<number | null>(null);
  const [companyOptions, setCompanyOptions] = React.useState<
    SearchableSelectOption[]
  >([]);
  const [actorUserOptions, setActorUserOptions] = React.useState<
    ActorUserOption[]
  >([]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  React.useEffect(() => {
    let cancelled = false;

    const loadFilterOptions = async () => {
      const [companiesResult, usersResult] = await Promise.all([
        getCompanies(),
        getUsers(),
      ]);

      if (cancelled) {
        return;
      }

      if (companiesResult.success && companiesResult.data) {
        setCompanyOptions(
          companiesResult.data.map((companyRow) => ({
            value: String(companyRow.id),
            label: companyRow.name,
          })),
        );
      }

      if (usersResult.success && usersResult.data) {
        setActorUserOptions(
          usersResult.data.map((userRow) => ({
            value: String(userRow.id),
            label: userRow.name,
            companyId: userRow.company_id ?? null,
          })),
        );
      }
    };

    void loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredActorUserOptions = React.useMemo(() => {
    if (!targetCompanyId.trim()) {
      return actorUserOptions;
    }
    const selectedCompanyId = Number(targetCompanyId);
    if (!Number.isFinite(selectedCompanyId)) {
      return actorUserOptions;
    }
    return actorUserOptions.filter(
      (option) => option.companyId === selectedCompanyId,
    );
  }, [actorUserOptions, targetCompanyId]);

  React.useEffect(() => {
    if (!targetCompanyId.trim() || !actorUserId || actorUserOptions.length === 0) {
      return;
    }
    const selectedCompanyId = Number(targetCompanyId);
    if (!Number.isFinite(selectedCompanyId)) {
      return;
    }
    const actorStillValid = actorUserOptions.some(
      (option) =>
        option.value === actorUserId && option.companyId === selectedCompanyId,
    );
    if (!actorStillValid) {
      setActorUserId('');
    }
  }, [actorUserId, actorUserOptions, targetCompanyId]);

  const handleTargetCompanyChange = (nextCompanyId: string) => {
    setTargetCompanyId(nextCompanyId);
    if (!nextCompanyId) {
      return;
    }
    const selectedCompanyId = Number(nextCompanyId);
    if (!Number.isFinite(selectedCompanyId) || !actorUserId) {
      return;
    }
    const actorStillValid = actorUserOptions.some(
      (option) =>
        option.value === actorUserId && option.companyId === selectedCompanyId,
    );
    if (!actorStillValid) {
      setActorUserId('');
    }
  };

  const filterSnapshot = React.useMemo(
    () => ({
      search: debouncedSearch,
      targetCompanyId,
      actorUserId,
      resourceType,
      resourceId,
      actionFilter,
      resultFilter,
      fromDate,
      toDate,
      incidentsOnly,
    }),
    [
      actionFilter,
      actorUserId,
      debouncedSearch,
      fromDate,
      incidentsOnly,
      resourceId,
      resourceType,
      resultFilter,
      targetCompanyId,
      toDate,
    ],
  );

  React.useEffect(() => {
    const params = buildFilterQuery(filterSnapshot);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [filterSnapshot, pathname, router]);

  const fetchEvents = React.useCallback(
    async (cursor?: number | null, append = false) => {
      setLoading(true);
      setLoadError(null);
      if (!append) {
        setEvents([]);
        setNextCursor(null);
        setExpandedId(null);
      }
      try {
        const params = buildFilterQuery(filterSnapshot);
        if (cursor != null) {
          params.set('cursor', String(cursor));
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
              payload?.error || 'No se pudo cargar la auditoría',
            ),
          );
          return;
        }

        const items = (payload.data?.items ?? []) as AuditEventRow[];
        setEvents((current) => (append ? [...current, ...items] : items));
        setNextCursor(payload.data?.nextCursor ?? null);
      } catch (error) {
        console.error(error);
        setLoadError(
          getErrorMessageByType(
            classifyClientError(error),
            'No se pudo cargar la auditoría',
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [filterSnapshot],
  );

  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const columns = React.useMemo(() => createAuditColumns(), []);
  const table = useReactTable({
    data: events,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleToggleExpanded = (id: number) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  const today = formatLocalDateInput(new Date());
  const sevenDaysAgo = daysAgoLocalDate(7);
  const isTodayPreset = fromDate === today && !toDate;
  const isSevenDayPreset = fromDate === sevenDaysAgo && !toDate;

  const handlePresetToday = () => {
    if (isTodayPreset) {
      setFromDate('');
      return;
    }
    setFromDate(today);
    setToDate('');
  };

  const handlePresetSevenDays = () => {
    if (isSevenDayPreset) {
      setFromDate('');
      return;
    }
    setFromDate(sevenDaysAgo);
    setToDate('');
  };

  const handlePresetDenied = () => {
    setResultFilter((current) => (current === 'denied' ? 'all' : 'denied'));
  };

  const handlePresetFailed = () => {
    setResultFilter((current) => (current === 'failed' ? 'all' : 'failed'));
  };

  const handlePresetIncidents = () => {
    setIncidentsOnly((current) => !current);
  };

  const hasActiveFilters =
    debouncedSearch !== '' ||
    targetCompanyId.trim() !== '' ||
    actorUserId.trim() !== '' ||
    resourceType !== 'all' ||
    resourceId.trim() !== '' ||
    actionFilter !== 'all' ||
    resultFilter !== 'all' ||
    fromDate !== '' ||
    toDate !== '' ||
    incidentsOnly;
  const listState = resolveResourceListState({
    isLoading: loading && events.length === 0,
    loadError,
    totalCount: events.length,
    visibleCount: events.length,
    hasActiveFilters,
  });

  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setTargetCompanyId('');
    setActorUserId('');
    setResourceType('all');
    setResourceId('');
    setActionFilter('all');
    setResultFilter('all');
    setFromDate('');
    setToDate('');
    setIncidentsOnly(false);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = buildFilterQuery(filterSnapshot);
      const response = await fetch(
        `/api/audit/events/export?${params.toString()}`,
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const errorType = classifyClientError(
          null,
          response.status,
          payload?.errorType,
        );
        setLoadError(
          getErrorMessageByType(
            errorType,
            payload?.error || 'No se pudo exportar la auditoría',
          ),
        );
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = objectUrl;
      anchor.download = `auditoria-${stamp}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error(error);
      setLoadError(
        getErrorMessageByType(
          classifyClientError(error),
          'No se pudo exportar la auditoría',
        ),
      );
    } finally {
      setExporting(false);
    }
  };

  const presetButtonClass = (active: boolean) =>
    cn(
      'h-8 rounded-full px-3 text-xs',
      active && 'border-primary bg-primary/10 text-primary',
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Buscar por recurso, acción o resultado"
            className="h-11 rounded-xl pl-9"
            aria-label="Buscar eventos de auditoría"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleExportCsv()}
          disabled={exporting || loading}
          aria-label="Exportar auditoría a CSV"
        >
          <Download className="size-4" aria-hidden />
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </Button>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Presets de investigación"
      >
        <Button
          type="button"
          variant="outline"
          className={presetButtonClass(isTodayPreset)}
          aria-pressed={isTodayPreset}
          onClick={handlePresetToday}
        >
          Hoy
        </Button>
        <Button
          type="button"
          variant="outline"
          className={presetButtonClass(isSevenDayPreset)}
          aria-pressed={isSevenDayPreset}
          onClick={handlePresetSevenDays}
        >
          Últimos 7 días
        </Button>
        <Button
          type="button"
          variant="outline"
          className={presetButtonClass(resultFilter === 'denied')}
          aria-pressed={resultFilter === 'denied'}
          onClick={handlePresetDenied}
        >
          Solo denegados
        </Button>
        <Button
          type="button"
          variant="outline"
          className={presetButtonClass(resultFilter === 'failed')}
          aria-pressed={resultFilter === 'failed'}
          onClick={handlePresetFailed}
        >
          Solo fallidos
        </Button>
        <Button
          type="button"
          variant="outline"
          className={presetButtonClass(incidentsOnly)}
          aria-pressed={incidentsOnly}
          onClick={handlePresetIncidents}
        >
          Solo incidentes
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SearchableSelect
          value={targetCompanyId}
          onValueChange={handleTargetCompanyChange}
          options={companyOptions}
          placeholder="Empresa objetivo"
          searchPlaceholder="Buscar empresa…"
          emptyText="No hay empresas"
          aria-label="Filtrar por empresa objetivo"
        />
        <SearchableSelect
          value={actorUserId}
          onValueChange={setActorUserId}
          options={filteredActorUserOptions}
          placeholder="Actor usuario"
          searchPlaceholder="Buscar usuario…"
          emptyText="No hay usuarios"
          aria-label="Filtrar por actor usuario"
        />
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
        <Input
          value={resourceId}
          onChange={(event) => setResourceId(event.target.value)}
          placeholder="ID de recurso"
          aria-label="Filtrar por ID de recurso"
        />
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
            <SelectItem value="all">Todos</SelectItem>
            {AUDIT_RESULTS.map((result) => (
              <SelectItem key={result} value={result}>
                {formatAuditResultLabel(result)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="space-y-1.5">
          <Label htmlFor="audit-from-date">Desde</Label>
          <Input
            id="audit-from-date"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            aria-label="Filtrar desde fecha"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-to-date">Hasta</Label>
          <Input
            id="audit-to-date"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            aria-label="Filtrar hasta fecha"
          />
        </div>
      </div>

      {listState.kind === 'loading' ? (
        <TripledListLoadingState
          label="Cargando eventos de auditoría"
          desktopColumns={6}
          desktopRows={5}
        />
      ) : listState.kind === 'error' ? (
        <TripledEmptyState
          icon={<ClipboardList className="h-4 w-4" />}
          title="Error al cargar"
          description={listState.message}
          role="alert"
          action={
            <Button type="button" variant="outline" onClick={() => fetchEvents()}>
              Reintentar
            </Button>
          }
        />
      ) : listState.kind === 'empty' ? (
        <TripledEmptyState
          icon={<ClipboardList className="h-4 w-4" />}
          title="Sin eventos"
          description="No hay eventos de auditoría registrados todavía."
        />
      ) : listState.kind === 'filtered-empty' ? (
        <TripledEmptyState
          icon={<ClipboardList className="h-4 w-4" />}
          title="Sin resultados"
          description="No hay eventos de auditoría para los filtros seleccionados."
          action={
            <Button type="button" variant="outline" onClick={handleClearFilters}>
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {events.map((event) => {
              const summary = formatAuditEventSummary(event);
              return (
                <article
                  key={event.id}
                  className="cursor-pointer rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
                  onClick={() => handleToggleExpanded(event.id)}
                  onKeyDown={(keyboardEvent) => {
                    if (
                      keyboardEvent.key === 'Enter' ||
                      keyboardEvent.key === ' '
                    ) {
                      keyboardEvent.preventDefault();
                      handleToggleExpanded(event.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={summary.title}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium leading-snug">{summary.title}</p>
                      <p className="text-sm text-muted-foreground">
                        <FormattedDate
                          date={new Date(event.occurred_at)}
                          withTime
                        />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <AuditResourceLabel event={event} />
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={
                          event.result === 'denied' || event.result === 'failed'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {formatAuditResultLabel(event.result)}
                      </Badge>
                      <Badge variant="outline">
                        {formatAuditSourceLabel(event.source)}
                      </Badge>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Actor</dt>
                      <dd>
                        {event.actor_user_name?.trim() ||
                          event.actor_user_id ||
                          '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Empresa</dt>
                      <dd>
                        {event.target_company_name?.trim() ||
                          (event.target_company_id != null
                            ? String(event.target_company_id)
                            : '—')}
                      </dd>
                    </div>
                    {event.actor_company_name ? (
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Empresa actor</dt>
                        <dd>{event.actor_company_name}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {expandedId === event.id ? (
                    <div className="mt-3">
                      <AuditEventDetails event={event} />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableRow>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleExpanded(row.original.id)}
                        >
                          {expandedId === row.original.id ? 'Ocultar' : 'Ver'}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedId === row.original.id ? (
                      <TableRow>
                        <TableCell colSpan={columns.length + 1}>
                          <AuditEventDetails event={row.original} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {nextCursor ? (
            <div className="flex justify-center pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => fetchEvents(nextCursor, true)}
              >
                Cargar más
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
