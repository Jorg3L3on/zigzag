'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { ClipboardList, Search, X } from 'lucide-react';
import { fetchOperatorCompanyUsage } from '@/actions/operator-company-usage';
import { resetUserTemporaryPassword } from '@/actions/users';
import { AUDIT_ACTION_FILTER_OPTIONS } from '@/components/audit/audit-filter-fields';
import { DesktopSwitch } from '@/components/desktop-switch';
import {
  FILTER_SELECTED_CLASS,
  ListEmpty,
  ListError,
  ListFilterSelect,
  ListFooter,
  ListLoading,
  ListNoResults,
  ListStatusPill,
  ListTable,
  ListTableCard,
} from '@/components/list-page';
import { useOperatorCompany } from '@/components/operator-console/operator-company-context';
import { useOperatorActivityFeed } from '@/components/operator-console/use-operator-activity-feed';
import { TripledMobileRecordCard } from '@/components/tripled';
import { TemporaryPasswordDialog } from '@/components/users/temporary-password-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { redactAuditDisplayValue, resolveAuditResourceLink } from '@/lib/audit-display';
import type { OperatorCompanyPerson } from '@/lib/operator-company-usage';
import {
  ACTIVITY_DATE_OPTIONS,
  activityAlertReason,
  activityArea,
  activityChanges,
  activityResult,
  activitySentence,
  describeUserAgent,
  groupOperatorActivityEvents,
  isOperatorActor,
  type ActivityDatePreset,
  type OperatorActivityRow,
} from '@/lib/operator-activity';
import { formatWhenShort } from '@/lib/operator-console-format';
import { cn } from '@/lib/utils';

const REASON_LABEL: Record<string, string> = {
  invalid_credentials: 'Contraseña incorrecta',
  missing_credentials: 'Faltó correo o contraseña',
  throttled: 'Demasiados intentos',
  inactive_company: 'La empresa no permite entrar',
  missing_permission: 'Le falta el permiso',
  invalid_company_context: 'Empresa equivocada',
};

const reasonOf = (row: OperatorActivityRow): string | null => {
  const payload = row.payload ?? {};
  const raw = (payload.reason ?? payload.denial_reason) as string | undefined;
  if (typeof raw === 'string' && raw) return REASON_LABEL[raw] ?? raw;
  const extra = payload.extra as Record<string, unknown> | undefined;
  const reason = (payload as Record<string, unknown>).motivo ?? extra?.reason;
  return typeof reason === 'string' ? reason : null;
};

const whenRange = (row: OperatorActivityRow): string => {
  if (row.count <= 1) return formatWhenShort(row.occurred_at);
  const newest = row.times[0];
  const oldest = row.times[row.times.length - 1];
  return `${formatWhenShort(oldest)} a ${formatWhenShort(newest).replace(/^(hoy|ayer) /, '')}`;
};

const OperatorTag = () => (
  <span className="rounded-md bg-slate-100 px-1.5 font-semibold text-slate-700 lg:text-[11px]/[inherit] dark:bg-slate-800 dark:text-slate-300">
    Operador
  </span>
);

const EventSentence = ({ row, companyId }: { row: OperatorActivityRow; companyId: number }) => {
  const link = resolveAuditResourceLink(row.resource_type, row.resource_id, {
    tenantCompanyId: companyId,
  });
  const sentence = activitySentence(row);
  const reason = reasonOf(row);
  return (
    <div className="min-w-0">
      <p className="truncate" title={sentence}>
        {sentence}
      </p>
      <p className="flex min-w-0 items-center gap-1.5 truncate text-caption text-muted-foreground">
        {isOperatorActor(row) ? (
          <>
            <OperatorTag />
            <span aria-hidden>·</span>
          </>
        ) : null}
        <span>{activityArea(row)}</span>
        {row.count > 1 ? <span>· {whenRange(row)}</span> : reason ? <span>· {reason.toLowerCase()}</span> : null}
        {link ? (
          <>
            <span aria-hidden>·</span>
            <Link
              href={link.href}
              className="text-primary underline underline-offset-2"
              onClick={(event) => event.stopPropagation()}
            >
              {link.label}
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
};

const EventDetail = ({
  row,
  onClose,
  onShowPerson,
  onResetPassword,
  personIds,
}: {
  row: OperatorActivityRow;
  onClose: () => void;
  onShowPerson: (id: string) => void;
  onResetPassword: (row: OperatorActivityRow) => void;
  personIds: Set<string>;
}) => {
  const result = activityResult(row);
  const alertReason = activityAlertReason(row);
  const meta = row.request_meta ?? {};
  const device = describeUserAgent(meta.userAgent);
  const ip = typeof meta.ip === 'string' ? meta.ip : null;
  const changes = activityChanges(row.payload, redactAuditDisplayValue);
  const reason = reasonOf(row);
  const actorId = row.actor_user_id;
  const isCompanyPerson = actorId != null && personIds.has(actorId);
  const who = row.actor_name ?? (typeof row.payload?.email === 'string' ? row.payload.email : null);
  return (
    <aside
      aria-label="Detalle del evento"
      className="min-w-0 flex-[2_1_20rem] self-start rounded-xl border border-border bg-card p-4 lg:sticky lg:top-20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ListStatusPill tone={alertReason ? 'red' : result.tone}>
            {alertReason ? 'Alerta de seguridad' : result.label}
          </ListStatusPill>
          <h2 className="mt-2.5 text-base font-semibold">{activitySentence(row)}</h2>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Cerrar detalle" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <dl className="mt-4 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 text-sm">
        <dt className="text-muted-foreground">Quién</dt>
        <dd>
          {who ?? '—'}
          {isOperatorActor(row) ? (
            <span className="ml-2 align-middle">
              <OperatorTag />
            </span>
          ) : null}
        </dd>
        <dt className="text-muted-foreground">Cuándo</dt>
        <dd>
          {whenRange(row)}
          {row.count > 1 ? (
            <span className="block text-caption text-muted-foreground">
              {row.times
                .slice()
                .reverse()
                .map((time) => formatWhenShort(time).replace(/^(hoy|ayer) /, ''))
                .join(' · ')}
            </span>
          ) : null}
        </dd>
        {reason ? (
          <>
            <dt className="text-muted-foreground">Motivo</dt>
            <dd>{reason}</dd>
          </>
        ) : null}
        {device || ip ? (
          <>
            <dt className="text-muted-foreground">Desde</dt>
            <dd>
              {device ?? 'Dispositivo desconocido'}
              {ip ? <span className="block text-caption text-muted-foreground">IP {ip}</span> : null}
            </dd>
          </>
        ) : null}
        {alertReason ? (
          <>
            <dt className="text-muted-foreground">Por qué es alerta</dt>
            <dd>{alertReason}</dd>
          </>
        ) : null}
      </dl>
      {isCompanyPerson ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {row.action === 'sign_in_failed' || row.action === 'permission_denied' ? (
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onResetPassword(row)}>
              Dar contraseña temporal
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onShowPerson(actorId)}>
            Ver todo lo de {row.actor_name?.split(' ')[0] ?? 'esta persona'}
          </Button>
        </div>
      ) : null}
      {changes.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <Table aria-label="Antes y después" className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="h-9 px-3">Campo</TableHead>
                <TableHead className="h-9 px-3">Antes</TableHead>
                <TableHead className="h-9 px-3">Después</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.map((change) => (
                <TableRow key={change.field}>
                  <TableCell className="px-3 py-2 text-muted-foreground">{change.field}</TableCell>
                  <TableCell className="max-w-0 truncate px-3 py-2" title={change.before}>{change.before}</TableCell>
                  <TableCell className="max-w-0 truncate px-3 py-2" title={change.after}>{change.after}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <details className="mt-4 border-t border-border/60 pt-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
          Datos técnicos (JSON)
        </summary>
        <pre className="mt-2.5 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-caption">
          {JSON.stringify(
            redactAuditDisplayValue({
              action: row.action,
              result: row.result,
              resource_type: row.resource_type,
              resource_id: row.resource_id,
              count: row.count,
              payload: row.payload,
              request_meta: row.request_meta,
            }),
            null,
            2,
          )}
        </pre>
      </details>
    </aside>
  );
};

/**
 * Actividad (ZIG-I38-5, frames 3 and 6C): one sentence per event, filters by
 * date, person, action and «Solo alertas», the detail beside the table, and
 * «Cargar más» in the footer without losing rows (audit A1–A5, E8, E10).
 */
export const OperatorActivityPanel = () => {
  const { companyId } = useOperatorCompany();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [date, setDate] = React.useState<ActivityDatePreset>('7d');
  const [person, setPerson] = React.useState('all');
  const [action, setAction] = React.useState('all');
  const [alertsOnly, setAlertsOnly] = React.useState(searchParams.get('alertas') === '1');
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [people, setPeople] = React.useState<OperatorCompanyPerson[]>([]);
  const [resetTarget, setResetTarget] = React.useState<{ id: string; name: string } | null>(null);

  React.useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchValue.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchValue]);

  React.useEffect(() => {
    let cancelled = false;
    void fetchOperatorCompanyUsage(companyId).then((result) => {
      if (!cancelled && result.success && result.data) setPeople(result.data.people);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const filters = React.useMemo(
    () => ({
      companyId,
      search,
      date,
      actorUserId: person === 'all' ? null : person,
      action: action === 'all' ? null : action,
      alertsOnly,
    }),
    [companyId, search, date, person, action, alertsOnly],
  );
  const feed = useOperatorActivityFeed(filters);
  const rows = React.useMemo(() => groupOperatorActivityEvents(feed.events), [feed.events]);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const personIds = React.useMemo(() => new Set(people.map((p) => p.id)), [people]);

  React.useEffect(() => {
    setSelectedId(null);
  }, [filters]);

  const hasFilters = search !== '' || date !== '7d' || person !== 'all' || action !== 'all' || alertsOnly;
  const clearFilters = () => {
    setSearchValue('');
    setSearch('');
    setDate('7d');
    setPerson('all');
    setAction('all');
    setAlertsOnly(false);
  };

  const columns = React.useMemo<ColumnDef<OperatorActivityRow>[]>(
    () => [
      {
        id: 'when',
        enableSorting: false,
        meta: { className: 'w-28' },
        header: 'Cuándo',
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-300" title={new Date(row.original.occurred_at).toLocaleString('es-MX')}>
            {formatWhenShort(row.original.occurred_at)}
          </span>
        ),
      },
      {
        id: 'what',
        enableSorting: false,
        header: 'Qué pasó',
        cell: ({ row }) => <EventSentence row={row.original} companyId={companyId} />,
      },
      {
        id: 'result',
        enableSorting: false,
        meta: { className: 'w-32' },
        header: 'Resultado',
        cell: ({ row }) => {
          const result = activityResult(row.original);
          return <ListStatusPill tone={result.tone}>{result.label}</ListStatusPill>;
        },
      },
    ],
    [companyId],
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  const personOptions = [
    { value: 'all', label: 'Todas las personas' },
    ...people.map((p) => ({ value: p.id, label: p.name })),
  ];

  const footer = (
    <>
      {feed.moreError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          <span>{feed.moreError}</span>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={feed.loadMore}>
            Reintentar
          </Button>
        </div>
      ) : null}
      <ListFooter
        total={rows.length}
        noun="filas"
        label={
          rows.length === 0
            ? null
            : `Desde ${formatWhenShort(rows[rows.length - 1].occurred_at)}${feed.nextCursor != null ? ' · hay más' : ''}`
        }
        loadMore={{
          onLoadMore: feed.loadMore,
          hasMore: feed.nextCursor != null && !feed.moreError,
          loading: feed.loadingMore,
        }}
      />
    </>
  );

  const body = feed.loading ? (
    <ListLoading label="Cargando actividad" columns={3} />
  ) : feed.error ? (
    <ListError description={feed.error} onRetry={feed.retry} />
  ) : rows.length === 0 ? (
    hasFilters ? (
      <ListNoResults description="No hay actividad con estos filtros." onClear={clearFilters} />
    ) : (
      <ListEmpty
        icon={<ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden />}
        title="Sin actividad"
        description="Esta empresa no tiene actividad registrada."
      />
    )
  ) : null;

  const desktop = (
    <div className="space-y-5">
      {/* Own row (not ListToolbar): with four pills the shared toolbar squeezed the search to nothing at 1280. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative w-full max-w-[18.75rem] flex-[1_1_14rem]">
          <span className="sr-only">Buscar en la actividad</span>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Buscar en la actividad"
            className="h-11 rounded-xl pl-10"
          />
        </label>
        <ListFilterSelect
          value={date}
          allValue={'__none__' as ActivityDatePreset}
          onChange={setDate}
          options={ACTIVITY_DATE_OPTIONS}
          ariaLabel="Fecha"
          className="min-w-0"
        />
        <ListFilterSelect value={person} allValue="all" onChange={setPerson} options={personOptions} ariaLabel="Persona" className="min-w-0" />
        <ListFilterSelect
          value={action}
          allValue="all"
          onChange={setAction}
          options={AUDIT_ACTION_FILTER_OPTIONS}
          ariaLabel="Acción"
          className="min-w-0"
        />
        <button
          type="button"
          aria-pressed={alertsOnly}
          onClick={() => setAlertsOnly((value) => !value)}
          className={cn(
            'inline-flex h-11 items-center rounded-full border border-border bg-background px-4 text-base font-medium',
            alertsOnly && FILTER_SELECTED_CLASS,
          )}
        >
          Solo alertas
        </button>
        {hasFilters ? (
          <Button type="button" variant="ghost" className="h-11" onClick={clearFilters} aria-label="Limpiar filtros de actividad">
            Limpiar filtros
          </Button>
        ) : null}
        <Link
          href={`/audit?target_company_id=${companyId}`}
          className="ml-auto whitespace-nowrap text-sm font-medium text-primary hover:underline lg:text-[13px]"
        >
          Abrir en Auditoría
        </Link>
      </div>
      {body ?? (
        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-0 flex-[3_1_35rem]">
            <ListTableCard footer={footer}>
              <ListTable
                table={table}
                ariaLabel="Actividad de la empresa"
                rowTestId="operator-activity-row"
                onOpenRow={(row) => setSelectedId(row.original.id)}
                isRowSelected={(row) => row.original.id === selectedId}
              />
            </ListTableCard>
          </div>
          {selected ? (
            <EventDetail
              row={selected}
              personIds={personIds}
              onClose={() => setSelectedId(null)}
              onShowPerson={(id) => setPerson(id)}
              onResetPassword={(row) =>
                row.actor_user_id
                  ? setResetTarget({ id: row.actor_user_id, name: row.actor_name ?? 'esta persona' })
                  : null
              }
            />
          ) : null}
        </div>
      )}
    </div>
  );

  const phone = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <ListFilterSelect
          value={date}
          allValue={'__none__' as ActivityDatePreset}
          onChange={setDate}
          options={ACTIVITY_DATE_OPTIONS}
          ariaLabel="Fecha"
        />
        <button
          type="button"
          aria-pressed={alertsOnly}
          onClick={() => setAlertsOnly((value) => !value)}
          className={cn(
            'inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-base font-medium',
            alertsOnly && FILTER_SELECTED_CLASS,
          )}
        >
          Solo alertas
        </button>
      </div>
      {body ?? (
        <>
          {rows.map((row) => {
            const result = activityResult(row);
            const open = row.id === selectedId;
            return (
              <TripledMobileRecordCard key={row.id} data-testid="operator-activity-card">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{activitySentence(row)}</p>
                    <ListStatusPill tone={result.tone}>{result.label}</ListStatusPill>
                  </div>
                  <p className="text-caption text-muted-foreground">
                    {formatWhenShort(row.occurred_at)} · {activityArea(row)}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 w-full"
                    aria-expanded={open}
                    onClick={() => setSelectedId(open ? null : row.id)}
                  >
                    {open ? 'Ocultar detalle' : 'Ver detalle'}
                  </Button>
                  {open ? (
                    <EventDetail
                      row={row}
                      personIds={personIds}
                      onClose={() => setSelectedId(null)}
                      onShowPerson={(id) => setPerson(id)}
                      onResetPassword={(r) =>
                        r.actor_user_id ? setResetTarget({ id: r.actor_user_id, name: r.actor_name ?? 'esta persona' }) : null
                      }
                    />
                  ) : null}
                </div>
              </TripledMobileRecordCard>
            );
          })}
          <div className="rounded-xl border border-border">{footer}</div>
        </>
      )}
    </div>
  );

  return (
    <>
      <DesktopSwitch phone={phone} desktop={desktop} />
      <TemporaryPasswordDialog
        target={resetTarget}
        onReset={() =>
          resetTarget ? resetUserTemporaryPassword(BigInt(resetTarget.id)) : Promise.resolve({ success: false })
        }
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
      />
    </>
  );
};
