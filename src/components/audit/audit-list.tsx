'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Row,
} from '@tanstack/react-table';
import type { DateRange } from 'react-day-picker';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { getCompanies } from '@/actions/companies';
import { getUsers } from '@/actions/users';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { DesktopSwitch } from '@/components/desktop-switch';
import {
  FILTER_SELECTED_CLASS,
  ListClickableRow,
  ListDesktopTitle,
  ListEmpty,
  ListError,
  ListFilterBarShell,
  ListFilterSelect,
  ListFooter,
  ListLoading,
  ListNoResults,
  ListTable,
  ListTableCard,
  ListToolbar,
  listColumnClassName,
} from '@/components/list-page';
import { TicketDateRangeFilter } from '@/components/tickets/tickets-filter-fields';
import { TripledEmptyState, TripledListLoadingState } from '@/components/tripled';
import { resolveResourceListState } from '@/lib/resource-list-state';
import { FormattedDate } from '@/components/formatted-date';
import {
  formatAuditResultLabel,
  formatAuditSourceLabel,
} from '@/lib/audit-labels';
import { actorDisplayName } from '@/lib/audit-actor-display';
import {
  createAuditColumns,
  type AuditEventRow,
} from '@/components/audit/audit-columns';
import { AuditSummaryCell } from '@/components/audit/audit-summary-cell';
import {
  AUDIT_ACTION_FILTER_OPTIONS,
  AUDIT_RESOURCE_FILTER_OPTIONS,
  AuditActionFilter,
  AuditActorFilter,
  AuditCompanyFilter,
  AuditDateRangeFilter,
  AuditResourceTypeFilter,
  AuditResultFilter,
  auditResultFilterOptions,
} from '@/components/audit/audit-filter-fields';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { redactAuditDisplayValue } from '@/lib/audit-display';
import {
  formatAuditEventSummary,
  hasRequestMetaContent,
} from '@/lib/audit-event-summary';
import { cn } from '@/lib/utils';
import type { SearchableSelectOption } from '@/components/ui/searchable-select';

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
    <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-caption">
      {JSON.stringify(redactAuditDisplayValue(value ?? {}), null, 2)}
    </pre>
  </section>
);

const metaString = (
  meta: Record<string, unknown> | null | undefined,
  key: string,
): string | null => {
  const value = meta?.[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const truncateUserAgent = (value: string, max = 72): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const AuditEventDetails = ({ event }: { event: AuditEventRow }) => {
  const [showJson, setShowJson] = React.useState(false);
  const summary = formatAuditEventSummary(event);
  const hasMeta = hasRequestMetaContent(event.request_meta);
  const route = metaString(event.request_meta, 'route');
  const method = metaString(event.request_meta, 'method');
  const ip = metaString(event.request_meta, 'ip');
  const userAgent = metaString(event.request_meta, 'userAgent');
  const requestId = metaString(event.request_meta, 'requestId');

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <h4 className="text-sm font-medium">Resumen</h4>
        <AuditSummaryCell event={event} className="space-y-1" />
      </section>

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
            {ip ? (
              <Badge variant="outline" aria-label={`IP ${ip}`}>
                IP: {ip}
              </Badge>
            ) : null}
            {requestId ? (
              <Badge variant="outline" aria-label={`Request ID ${requestId}`}>
                Request ID: {requestId}
              </Badge>
            ) : null}
            {userAgent ? (
              <Badge
                variant="secondary"
                className="max-w-full whitespace-normal text-left"
                aria-label={`User agent ${userAgent}`}
                title={userAgent}
              >
                UA: {truncateUserAgent(userAgent)}
              </Badge>
            ) : null}
            {!method && !route && !ip && !requestId && !userAgent ? (
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

const buildFilterQuery = (input: {
  search: string;
  targetCompanyId: string;
  actorUserId: string;
  resourceType: string;
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
    params.set('incidents_only', '1');
  }
  return params;
};

/** «yyyy-MM-dd» in the browser's calendar, as the date inputs and the URL carry it. */
const parseLocalDateInput = (value: string): Date | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const RESULT_FILTER_OPTIONS = auditResultFilterOptions('Todos los estatus');

const DEFAULT_DESCRIPTION = 'Visible solo para usuarios de la empresa System.';

export const AuditList = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [events, setEvents] = React.useState<AuditEventRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
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
      searchParams.get('incidents_only') === '1' ||
      searchParams.get('incidents_only') === 'true' ||
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
  // Only the latest filter request may land; an older one would overwrite it.
  const requestRef = React.useRef(0);

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

  /**
   * A filter change keeps the loaded rows on screen (dimmed on desktop) until the
   * new ones arrive (ZIG-I33 §8); «Cargar más» appends.
   */
  const fetchEvents = React.useCallback(
    async (cursor?: number | null, append = false) => {
      const request = append ? requestRef.current : ++requestRef.current;
      const isCurrent = () => request === requestRef.current;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setExpandedId(null);
      }
      setLoadError(null);
      const fail = (message: string) => {
        setLoadError(message);
        if (!append) {
          setEvents([]);
          setNextCursor(null);
        }
      };
      try {
        const params = buildFilterQuery(filterSnapshot);
        if (cursor != null) {
          params.set('cursor', String(cursor));
        }

        const response = await fetch(`/api/audit/events?${params.toString()}`);
        const payload = await response.json();
        if (!isCurrent()) return;
        if (!response.ok || !payload.success) {
          const errorType = classifyClientError(
            null,
            response.status,
            payload?.errorType,
          );
          fail(
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
        if (!isCurrent()) return;
        fail(
          getErrorMessageByType(
            classifyClientError(error),
            'No se pudo cargar la auditoría',
          ),
        );
      } finally {
        if (append) {
          setLoadingMore(false);
        } else if (isCurrent()) {
          setLoading(false);
        }
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

  const dateRange = React.useMemo<DateRange | undefined>(() => {
    const from = parseLocalDateInput(fromDate);
    if (!from) return undefined;
    return { from, to: parseLocalDateInput(toDate) };
  }, [fromDate, toDate]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setFromDate(range?.from ? formatLocalDateInput(range.from) : '');
    setToDate(range?.to ? formatLocalDateInput(range.to) : '');
  };

  const hasActiveFilters =
    debouncedSearch !== '' ||
    targetCompanyId.trim() !== '' ||
    actorUserId.trim() !== '' ||
    resourceType !== 'all' ||
    actionFilter !== 'all' ||
    resultFilter !== 'all' ||
    fromDate !== '' ||
    toDate !== '' ||
    incidentsOnly;

  /** The phone filter badge counts dense controls only (search + presets stay outside). */
  const sheetFilterCount = [
    targetCompanyId.trim() !== '',
    actorUserId.trim() !== '',
    resourceType !== 'all',
    actionFilter !== 'all',
    resultFilter !== 'all',
    fromDate !== '',
    toDate !== '',
  ].filter(Boolean).length;

  const listState = resolveResourceListState({
    isLoading: loading && events.length === 0,
    loadError,
    totalCount: events.length,
    visibleCount: events.length,
    hasActiveFilters,
  });
  const refreshing = loading && events.length > 0;

  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setTargetCompanyId('');
    setActorUserId('');
    setResourceType('all');
    setActionFilter('all');
    setResultFilter('all');
    setFromDate('');
    setToDate('');
    setIncidentsOnly(false);
  };

  const presets = [
    { label: 'Hoy', active: isTodayPreset, onClick: handlePresetToday },
    { label: 'Últimos 7 días', active: isSevenDayPreset, onClick: handlePresetSevenDays },
    { label: 'Solo denegados', active: resultFilter === 'denied', onClick: handlePresetDenied },
    { label: 'Solo fallidos', active: resultFilter === 'failed', onClick: handlePresetFailed },
    { label: 'Solo incidentes', active: incidentsOnly, onClick: handlePresetIncidents },
  ];

  const renderPresets = (buttonClass: (active: boolean) => string) => (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Presets de investigación"
    >
      {presets.map((preset) => (
        <Button
          key={preset.label}
          type="button"
          variant="outline"
          className={buttonClass(preset.active)}
          aria-pressed={preset.active}
          onClick={preset.onClick}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );

  const loadedLabel = `${events.length} ${events.length === 1 ? 'evento cargado' : 'eventos cargados'}`;

  const sheetContent = (
    <>
      <AuditCompanyFilter
        layout="sheet"
        value={targetCompanyId}
        onChange={handleTargetCompanyChange}
        options={companyOptions}
      />
      <AuditActorFilter
        layout="sheet"
        value={actorUserId}
        onChange={setActorUserId}
        options={filteredActorUserOptions}
      />
      <AuditResourceTypeFilter
        layout="sheet"
        value={resourceType}
        onChange={setResourceType}
      />
      <AuditActionFilter
        layout="sheet"
        value={actionFilter}
        onChange={setActionFilter}
      />
      <AuditResultFilter
        layout="sheet"
        value={resultFilter}
        onChange={setResultFilter}
      />
      <AuditDateRangeFilter
        layout="sheet"
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
      />
    </>
  );

  const phone = (
    <div className="space-y-4">
      {/* The shared sheet: its Limpiar is the neutral one (f6ffafda). */}
      <ListFilterBarShell
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Buscar por recurso, acción o resultado"
        searchAriaLabel="Buscar eventos de auditoría"
        searchClassName="h-12 rounded-xl pl-9 sm:h-11"
        searchContainerClassName="relative min-w-0 flex-1"
        sheetFilterCount={sheetFilterCount}
        sheetDescription="Empresa, actor, recurso, acción, estatus y fechas."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        clearFiltersAriaLabel="Limpiar todos los filtros"
        filterChips={[]}
        sheetContent={sheetContent}
        desktopContent={null}
        showDesktopClear={false}
      />

      <div className="flex flex-wrap items-center gap-2">
        {renderPresets((active) =>
          cn(
            'h-8 rounded-full px-3 text-caption',
            active && 'border-primary bg-primary/10 text-primary',
          ),
        )}
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-caption"
            onClick={handleClearFilters}
            aria-label="Limpiar todos los filtros"
          >
            Limpiar filtros
          </Button>
        ) : null}
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
          <div className="space-y-3">
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
                    <div className="min-w-0 flex-1 space-y-1">
                      <AuditSummaryCell
                        event={event}
                        className="min-w-0 space-y-1"
                      />
                      <p className="text-sm text-muted-foreground">
                        <FormattedDate
                          date={new Date(event.occurred_at)}
                          withTime
                        />
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
                        {actorDisplayName(
                          event.actor_user_id,
                          event.actor_name,
                        )}
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

          {nextCursor ? (
            <div className="flex justify-center pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={loading || loadingMore}
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

  /** The event row opens its detail underneath, by click, Enter or Space (ZIG-I33 §4). */
  const renderDesktopRow = (row: Row<AuditEventRow>) => {
    const expanded = expandedId === row.original.id;
    const cells = row.getVisibleCells();
    return (
      <React.Fragment key={row.id}>
        <ListClickableRow
          data-testid="audit-row"
          aria-expanded={expanded}
          selected={expanded}
          onOpen={() => handleToggleExpanded(row.original.id)}
        >
          {cells.map((cell) => (
            <TableCell
              key={cell.id}
              className={listColumnClassName(cell.column.columnDef.meta)}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ))}
        </ListClickableRow>
        {expanded ? (
          <TableRow
            className="bg-muted/30 hover:bg-muted/30"
            data-testid="audit-row-detail"
          >
            <TableCell colSpan={cells.length} className="h-auto! py-4!">
              <AuditEventDetails event={row.original} />
            </TableCell>
          </TableRow>
        ) : null}
      </React.Fragment>
    );
  };

  const desktop = (
    <>
      <ListDesktopTitle
        title="Auditoría"
        description={
          listState.kind === 'ready'
            ? `${DEFAULT_DESCRIPTION.replace(/\.$/, '')} · ${loadedLabel}.`
            : DEFAULT_DESCRIPTION
        }
      />
      <div className="space-y-4">
        <ListToolbar
          search={{
            value: searchValue,
            onChange: setSearchValue,
            placeholder: 'Buscar por recurso, acción o resultado',
            ariaLabel: 'Buscar eventos de auditoría',
          }}
          filters={
            <>
              <ListFilterSelect
                value={resourceType}
                allValue="all"
                onChange={setResourceType}
                options={AUDIT_RESOURCE_FILTER_OPTIONS}
                ariaLabel="Filtrar por tipo de recurso"
              />
              <ListFilterSelect
                value={actionFilter}
                allValue="all"
                onChange={setActionFilter}
                options={AUDIT_ACTION_FILTER_OPTIONS}
                ariaLabel="Filtrar por acción"
              />
              <ListFilterSelect
                value={resultFilter}
                allValue="all"
                onChange={setResultFilter}
                options={RESULT_FILTER_OPTIONS}
                ariaLabel="Filtrar por resultado"
              />
            </>
          }
          hasActiveFilters={hasActiveFilters}
          onClear={handleClearFilters}
          clearAriaLabel="Limpiar todos los filtros"
          quickFilters={
            <div className="flex flex-wrap items-center gap-3">
              {renderPresets((active) =>
                cn('h-11 rounded-full px-4', active && FILTER_SELECTED_CLASS),
              )}
              <TicketDateRangeFilter
                layout="desktop"
                value={dateRange}
                onChange={handleDateRangeChange}
                ariaLabel="Filtrar por rango de fechas"
              />
              <AuditCompanyFilter
                layout="desktop"
                value={targetCompanyId}
                onChange={handleTargetCompanyChange}
                options={companyOptions}
              />
              <AuditActorFilter
                layout="desktop"
                value={actorUserId}
                onChange={setActorUserId}
                options={filteredActorUserOptions}
              />
            </div>
          }
        />

        {listState.kind === 'loading' ? (
          <ListLoading label="Cargando eventos de auditoría" columns={6} />
        ) : listState.kind === 'error' ? (
          <ListError description={listState.message} onRetry={() => fetchEvents()} />
        ) : listState.kind === 'empty' ? (
          <ListEmpty
            icon={<ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden />}
            title="Sin eventos"
            description="No hay eventos de auditoría registrados todavía."
          />
        ) : listState.kind === 'filtered-empty' ? (
          <ListNoResults
            description="No hay eventos de auditoría para los filtros seleccionados."
            onClear={handleClearFilters}
          />
        ) : (
          <ListTableCard
            footer={
              <ListFooter
                total={events.length}
                noun="eventos"
                label={loadedLabel}
                loadMore={{
                  hasMore: nextCursor != null,
                  loading: loadingMore,
                  onLoadMore: () => fetchEvents(nextCursor, true),
                }}
              />
            }
          >
            <ListTable
              table={table}
              ariaLabel="Eventos de auditoría"
              busy={refreshing}
              renderRow={renderDesktopRow}
            />
          </ListTableCard>
        )}
      </div>
    </>
  );

  return <DesktopSwitch phone={phone} desktop={desktop} />;
};
