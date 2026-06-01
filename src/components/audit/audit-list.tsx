'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, Search } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const AuditEventDetails = ({ event }: { event: AuditEventRow }) => (
  <div className="grid gap-3 md:grid-cols-2">
    <AuditJsonBlock title="Carga útil" value={event.payload} />
    <AuditJsonBlock title="Metadatos de solicitud" value={event.request_meta} />
  </div>
);

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
      onClick={(event) => event.stopPropagation()}
    >
      {link.label}
    </Link>
  );
};

export const AuditList = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [events, setEvents] = React.useState<AuditEventRow[]>([]);
  const [loading, setLoading] = React.useState(true);
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
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [nextCursor, setNextCursor] = React.useState<number | null>(null);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    }
    if (targetCompanyId.trim()) {
      params.set('target_company_id', targetCompanyId.trim());
    }
    if (actorUserId.trim()) {
      params.set('actor_user_id', actorUserId.trim());
    }
    if (resourceType !== 'all') {
      params.set('resource_type', resourceType);
    }
    if (resourceId.trim()) {
      params.set('resource_id', resourceId.trim());
    }
    if (actionFilter !== 'all') {
      params.set('action', actionFilter);
    }
    if (resultFilter !== 'all') {
      params.set('result', resultFilter);
    }
    if (fromDate) {
      params.set('from', fromDate);
    }
    if (toDate) {
      params.set('to', toDate);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [
    actionFilter,
    actorUserId,
    debouncedSearch,
    fromDate,
    pathname,
    resourceId,
    resourceType,
    resultFilter,
    router,
    targetCompanyId,
    toDate,
  ]);

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
        const params = new URLSearchParams();
        if (debouncedSearch) {
          params.set('search', debouncedSearch);
        }
        if (resourceType !== 'all') {
          params.set('resource_type', resourceType);
        }
        if (targetCompanyId.trim()) {
          params.set('target_company_id', targetCompanyId.trim());
        }
        if (actorUserId.trim()) {
          params.set('actor_user_id', actorUserId.trim());
        }
        if (resourceId.trim()) {
          params.set('resource_id', resourceId.trim());
        }
        if (actionFilter !== 'all') {
          params.set('action', actionFilter);
        }
        if (resultFilter !== 'all') {
          params.set('result', resultFilter);
        }
        if (fromDate) {
          params.set('from', fromDate);
        }
        if (toDate) {
          params.set('to', toDate);
        }
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
    [
      actionFilter,
      actorUserId,
      debouncedSearch,
      fromDate,
      resourceId,
      resourceType,
      resultFilter,
      targetCompanyId,
      toDate,
    ],
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
  const hasActiveFilters =
    debouncedSearch !== '' ||
    targetCompanyId.trim() !== '' ||
    actorUserId.trim() !== '' ||
    resourceType !== 'all' ||
    resourceId.trim() !== '' ||
    actionFilter !== 'all' ||
    resultFilter !== 'all' ||
    fromDate !== '' ||
    toDate !== '';
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
  };

  return (
    <div className="space-y-4">
      <div className="relative">
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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          value={targetCompanyId}
          onChange={(event) => setTargetCompanyId(event.target.value)}
          placeholder="Empresa objetivo"
          inputMode="numeric"
          aria-label="Filtrar por empresa objetivo"
        />
        <Input
          value={actorUserId}
          onChange={(event) => setActorUserId(event.target.value)}
          placeholder="Actor usuario"
          inputMode="numeric"
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
                {type}
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
            <SelectItem value="all">Todos</SelectItem>
            {AUDIT_RESULTS.map((result) => (
              <SelectItem key={result} value={result}>
                {result}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          aria-label="Filtrar desde fecha"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          aria-label="Filtrar hasta fecha"
        />
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
            {events.map((event) => (
              <article
                key={event.id}
                className="cursor-pointer rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
                onClick={() => handleToggleExpanded(event.id)}
                onKeyDown={(keyboardEvent) => {
                  if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                    keyboardEvent.preventDefault();
                    handleToggleExpanded(event.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Evento ${event.action} en ${event.resource_type}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      <AuditResourceLabel event={event} /> · {event.action}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <FormattedDate
                        date={new Date(event.occurred_at)}
                        withTime
                      />
                    </p>
                  </div>
                  <Badge
                    variant={event.result === 'denied' ? 'destructive' : 'secondary'}
                  >
                    {event.result}
                  </Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Actor</dt>
                    <dd>{event.actor_user_id ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Empresa</dt>
                    <dd>{event.target_company_id ?? '—'}</dd>
                  </div>
                </dl>
                {expandedId === event.id ? (
                  <div className="mt-3">
                    <AuditEventDetails event={event} />
                  </div>
                ) : null}
              </article>
            ))}
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
