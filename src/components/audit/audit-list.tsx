'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ClipboardList, Loader2, Search } from 'lucide-react';
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
import { TripledEmptyState } from '@/components/tripled';
import { FormattedDate } from '@/components/formatted-date';
import { Badge } from '@/components/ui/badge';
import {
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
  const [events, setEvents] = React.useState<AuditEventRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [resourceType, setResourceType] = React.useState<string>('all');
  const [resultFilter, setResultFilter] = React.useState<string>('all');
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [nextCursor, setNextCursor] = React.useState<number | null>(null);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const fetchEvents = React.useCallback(
    async (cursor?: number | null, append = false) => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) {
          params.set('search', debouncedSearch);
        }
        if (resourceType !== 'all') {
          params.set('resource_type', resourceType);
        }
        if (resultFilter !== 'all') {
          params.set('result', resultFilter);
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
    [debouncedSearch, resourceType, resultFilter],
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

      <div className="flex flex-wrap gap-2">
        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger className="w-[180px]" aria-label="Filtrar por tipo de recurso">
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
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger className="w-[160px]" aria-label="Filtrar por resultado">
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
      </div>

      {loading && events.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : loadError ? (
        <div className="space-y-3 text-center">
          <TripledEmptyState
            icon={<ClipboardList className="h-4 w-4" />}
            title="Error al cargar"
            description={loadError}
          />
          <Button type="button" onClick={() => fetchEvents()}>
            Reintentar
          </Button>
        </div>
      ) : events.length === 0 ? (
        <TripledEmptyState
          icon={<ClipboardList className="h-4 w-4" />}
          title="Sin eventos"
          description="No hay eventos de auditoría para los filtros seleccionados."
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
