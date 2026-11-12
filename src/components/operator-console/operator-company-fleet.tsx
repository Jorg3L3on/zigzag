'use client';

import React from 'react';
import Link from 'next/link';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, Factory, FileSearch, Pencil, Plus, X } from 'lucide-react';
import { getOperatorCompanyFleet } from '@/actions/company-operator';
import { useCompany } from '@/contexts/company-context';
import {
  TripledEmptyState,
  TripledListLoadingState,
  TripledMobileRecordCard,
} from '@/components/tripled';
import {
  CompaniesFilterBar,
  FLEET_STATUS_FILTER_OPTIONS,
} from '@/components/companies/companies-filter-bar';
import {
  attentionLine,
  createOperatorFleetColumns,
} from '@/components/operator-console/operator-company-fleet-columns';
import { useOperatorCompanyActions } from '@/components/operator-console/use-operator-company-actions';
import { DesktopSwitch } from '@/components/desktop-switch';
import {
  ListDesktopTitle,
  ListEmpty,
  ListError,
  ListFooter,
  ListLoading,
  ListNoResults,
  ListRowMenu,
  ListStatusPill,
  ListTable,
  ListTableCard,
  ListToolbar,
  ListViewTabs,
  type ListRowMenuItem,
} from '@/components/list-page';
import { resolveResourceListState } from '@/lib/resource-list-state';
import {
  operatorConsoleCompanyHref,
  operatorTenantHref,
} from '@/lib/operator-tenant-scope';
import { formatRelative, LIFECYCLE_TONE, plural } from '@/lib/operator-console-format';
import { Button } from '@/components/ui/button';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import type { OperatorFleetRow } from '@/lib/company-operator-fleet';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

type FleetView = 'all' | 'attention' | 'active' | 'setup' | 'suspended' | 'archived';
type PhoneStatusFilter = 'all' | 'setup' | 'active' | 'suspended' | 'archived';

/** «Nueva empresa» opens the create page. */
const NEW_COMPANY_HREF = '/companies/new';

const VIEW_DOT: Record<FleetView, string | null> = {
  all: null,
  attention: 'bg-amber-500',
  active: 'bg-emerald-500',
  setup: 'bg-blue-500',
  suspended: 'bg-red-500',
  archived: 'bg-slate-400',
};

const VIEW_LABEL: Record<FleetView, string> = {
  all: 'Todas',
  attention: 'Requieren atención',
  active: 'Activas',
  setup: 'En configuración',
  suspended: 'Suspendidas',
  archived: 'Archivadas',
};

export const matchesFleetView = (row: OperatorFleetRow, view: FleetView): boolean => {
  switch (view) {
    case 'attention':
      return row.needsAttention;
    case 'active':
      return row.lifecycle === 'ACTIVE';
    case 'setup':
      return row.lifecycle === 'SETUP';
    case 'suspended':
      return row.lifecycle === 'SUSPENDED';
    case 'archived':
      return row.lifecycle === 'ARCHIVED';
    default:
      return true;
  }
};

const matchesSearch = (row: OperatorFleetRow, search: string): boolean =>
  !search ||
  row.name.toLowerCase().includes(search) ||
  row.email.toLowerCase().includes(search) ||
  row.phone.toLowerCase().includes(search);

const PHONE_TO_VIEW: Record<PhoneStatusFilter, FleetView> = {
  all: 'all',
  setup: 'setup',
  active: 'active',
  suspended: 'suspended',
  archived: 'archived',
};

/**
 * The fleet (ZIG-I38-3, frame 1): view tabs with counts and «Requieren
 * atención», search, and the table with the attention reason per company.
 * Opening a company never changes the app's selected company (audit P3).
 */
export const OperatorCompanyFleet = () => {
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const canWriteCompanies =
    permissions.isSystem && permissions.can(PERMISSIONS.companies.write);
  const router = useRouter();
  const { operateAs } = useOperatorCompanyActions();

  const [rows, setRows] = React.useState<OperatorFleetRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [view, setView] = React.useState<FleetView>('all');
  const [phoneStatus, setPhoneStatus] = React.useState<PhoneStatusFilter>('all');
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'name', desc: false }]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(searchValue.trim()), 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const fetchFleet = React.useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'load') setLoading(true);
    else setRefreshing(true);
    setLoadError(null);
    try {
      const result = await getOperatorCompanyFleet();
      if (result.success && result.data) {
        setRows(result.data);
      } else {
        setLoadError(
          getErrorMessageByType(
            classifyClientError(null, undefined, result.errorType),
            result.error || 'No se pudo cargar la flota de empresas',
          ),
        );
      }
    } catch (error) {
      setLoadError(
        getErrorMessageByType(classifyClientError(error), 'No se pudo cargar la flota de empresas'),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchFleet();
  }, [fetchFleet]);

  // Back from a company page (bfcache or a focus after a change): read again (audit E4).
  React.useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) void fetchFleet('refresh');
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [fetchFleet]);

  const search = debouncedSearch.toLowerCase();
  const searched = React.useMemo(
    () => rows.filter((row) => matchesSearch(row, search)),
    [rows, search],
  );

  const effectiveView = view;
  const filteredRows = React.useMemo(
    () => searched.filter((row) => matchesFleetView(row, effectiveView)),
    [searched, effectiveView],
  );
  const phoneRows = React.useMemo(
    () => searched.filter((row) => matchesFleetView(row, PHONE_TO_VIEW[phoneStatus])),
    [searched, phoneStatus],
  );

  const counts = React.useMemo(() => {
    const result = {} as Record<FleetView, number>;
    (Object.keys(VIEW_LABEL) as FleetView[]).forEach((id) => {
      result[id] = rows.filter((row) => matchesFleetView(row, id)).length;
    });
    return result;
  }, [rows]);
  const alertCount = React.useMemo(() => rows.filter((row) => row.alert).length, [rows]);

  const isContext = React.useCallback(
    (row: OperatorFleetRow) => selectedCompany?.id === row.id,
    [selectedCompany?.id],
  );

  const rowMenuItems = React.useCallback(
    (row: OperatorFleetRow): ListRowMenuItem[] => [
      ...(row.lifecycle === 'ACTIVE'
        ? [
            {
              label: 'Operar como esta empresa',
              icon: <ArrowRightLeft className="h-4 w-4" aria-hidden />,
              onSelect: () => operateAs({ id: row.id, name: row.name, logo: row.logo }),
            },
          ]
        : []),
      ...(canWriteCompanies && row.lifecycle !== 'ARCHIVED'
        ? [
            {
              label: 'Editar',
              icon: <Pencil className="h-4 w-4" aria-hidden />,
              onSelect: () => router.push(operatorTenantHref(row.editHref, row.id)),
            },
          ]
        : []),
      {
        label: 'Ver en Auditoría',
        icon: <FileSearch className="h-4 w-4" aria-hidden />,
        onSelect: () => router.push(`/audit?target_company_id=${row.id}`),
      },
    ],
    [canWriteCompanies, operateAs, router],
  );

  const columns = React.useMemo(
    () =>
      createOperatorFleetColumns({
        isContext,
        renderActions: (row) => (
          <>
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link
                href={operatorConsoleCompanyHref(row.id)}
                aria-label={`Abrir ${row.name}`}
                onClick={(event) => event.stopPropagation()}
              >
                Abrir
              </Link>
            </Button>
            <ListRowMenu label={`Acciones de ${row.name}`} items={rowMenuItems(row)} />
          </>
        ),
      }),
    [isContext, rowMenuItems],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const hasActiveFilters = debouncedSearch !== '';
  const listState = resolveResourceListState({
    isLoading: loading,
    loadError,
    totalCount: rows.length,
    visibleCount: filteredRows.length,
    hasActiveFilters: hasActiveFilters || view !== 'all',
  });
  const phoneState = resolveResourceListState({
    isLoading: loading,
    loadError,
    totalCount: rows.length,
    visibleCount: phoneRows.length,
    hasActiveFilters: hasActiveFilters || phoneStatus !== 'all',
  });

  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setView('all');
    setPhoneStatus('all');
  };

  const tabs = (Object.keys(VIEW_LABEL) as FleetView[]).map((id) => ({
    id,
    label: VIEW_LABEL[id],
    count: loading ? null : counts[id],
    dot: VIEW_DOT[id],
    caption: loading
      ? null
      : id === 'all'
        ? plural(counts.all, 'empresa', 'empresas')
        : id === 'attention' && alertCount > 0
          ? `${counts.attention} · ${plural(alertCount, 'alerta', 'alertas')}`
          : String(counts[id]),
  }));

  const filterChips = [
    { key: 'count', label: `${phoneRows.length} de ${rows.length} empresas`, variant: 'secondary' as const },
    ...(debouncedSearch ? [{ key: 'search', label: `Búsqueda: ${debouncedSearch}` }] : []),
  ];

  const phone = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Flota de empresas</h2>
          <p className="text-sm text-muted-foreground">
            Estado, atención y último acceso de cada empresa.
          </p>
        </div>
        {canWriteCompanies ? (
          <Button asChild className="min-h-11 rounded-xl">
            <Link href={NEW_COMPANY_HREF}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Nueva empresa
            </Link>
          </Button>
        ) : null}
      </div>

      <CompaniesFilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        statusFilter={phoneStatus}
        onStatusFilterChange={setPhoneStatus}
        statusOptions={FLEET_STATUS_FILTER_OPTIONS}
        showSort={false}
        sheetFilterCount={phoneStatus !== 'all' ? 1 : 0}
        hasActiveFilters={hasActiveFilters || phoneStatus !== 'all'}
        onClearFilters={handleClearFilters}
        filterChips={filterChips}
        clearFiltersAriaLabel="Limpiar filtros de flota"
        searchPlaceholder="Buscar empresa, correo o teléfono"
        searchClassName="min-h-11 rounded-xl pl-9"
        searchTrailing={
          searchValue ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 h-9 w-9 -translate-y-1/2"
              aria-label="Limpiar búsqueda"
              onClick={() => setSearchValue('')}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null
        }
      />

      {phoneState.kind === 'loading' ? (
        <TripledListLoadingState label="Cargando flota de empresas…" />
      ) : null}
      {phoneState.kind === 'error' ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-destructive">{phoneState.message}</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void fetchFleet()}>
            Reintentar
          </Button>
        </div>
      ) : null}
      {phoneState.kind === 'empty' || phoneState.kind === 'filtered-empty' ? (
        <TripledEmptyState
          icon={<Factory className="h-4 w-4" aria-hidden />}
          title={phoneState.kind === 'filtered-empty' ? 'Sin coincidencias' : 'Sin empresas'}
          description={
            phoneState.kind === 'filtered-empty'
              ? 'No hay empresas que coincidan con el filtro.'
              : 'Aún no hay empresas operativas en la plataforma.'
          }
        />
      ) : null}

      {phoneState.kind === 'ready' ? (
        <div className="space-y-3">
          {phoneRows.map((row) => {
            const first = row.attention[0];
            return (
              <TripledMobileRecordCard
                key={row.id}
                className={cn(isContext(row) && 'ring-2 ring-primary/40')}
                data-testid="operator-fleet-card"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">
                        <Link href={operatorConsoleCompanyHref(row.id)} className="hover:underline">
                          {row.name}
                        </Link>
                      </h3>
                      <p className="truncate text-caption text-muted-foreground">{row.email}</p>
                    </div>
                    {isContext(row) ? (
                      <span className="shrink-0 rounded-md border border-blue-200 px-1.5 text-caption font-semibold text-blue-700 dark:border-blue-900 dark:text-blue-300">
                        Tu contexto
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <ListStatusPill tone={LIFECYCLE_TONE[row.lifecycle]}>{row.lifecycleLabel}</ListStatusPill>
                    {first ? <ListStatusPill tone={first.tone}>{first.label}</ListStatusPill> : null}
                  </div>
                  <div className="space-y-1 text-caption text-muted-foreground">
                    {first ? <p>{attentionLine(row)}</p> : null}
                    <p>
                      {plural(row.peopleCount, 'persona', 'personas')} · Último acceso:{' '}
                      {row.lastSignInAt ? formatRelative(row.lastSignInAt) : 'nunca'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button asChild variant="outline" size="sm" className="min-h-11 w-full">
                      <Link href={operatorConsoleCompanyHref(row.id)} aria-label={`Abrir ${row.name}`}>
                        Abrir
                      </Link>
                    </Button>
                    {canWriteCompanies && row.lifecycle !== 'ARCHIVED' ? (
                      <Button asChild variant="outline" size="sm" className="min-h-11 w-full">
                        <Link href={operatorTenantHref(row.editHref, row.id)} aria-label={`Editar ${row.name}`}>
                          <Pencil className="mr-2 h-4 w-4" aria-hidden />
                          Editar
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </TripledMobileRecordCard>
            );
          })}
        </div>
      ) : null}
    </div>
  );

  const desktop = (
    <div className="space-y-5">
      <ListDesktopTitle
        title="Consola operadora"
        count={loading || loadError ? null : rows.length}
        description="Todas las empresas de ZigZag: cuál necesita atención, quién está entrando y en qué estado está cada una."
        actions={
          canWriteCompanies ? (
            <Button asChild>
              <Link href={NEW_COMPANY_HREF}>
                <Plus className="h-4 w-4" aria-hidden data-icon="inline-start" />
                Nueva empresa
              </Link>
            </Button>
          ) : null
        }
      />

      <ListViewTabs
        label="Vistas de la flota"
        tabs={tabs}
        isSelected={(id) => id === view}
        onSelect={setView}
      />

      <ListToolbar
        search={{
          value: searchValue,
          onChange: setSearchValue,
          placeholder: 'Buscar empresa, correo o teléfono',
          ariaLabel: 'Buscar empresas',
        }}
        hasActiveFilters={hasActiveFilters}
        onClear={handleClearFilters}
        clearAriaLabel="Limpiar filtros de flota"
      />

      {listState.kind === 'loading' ? (
        <ListLoading label="Cargando flota de empresas" columns={6} />
      ) : listState.kind === 'error' ? (
        <ListError description={listState.message} onRetry={() => void fetchFleet()} />
      ) : listState.kind === 'empty' ? (
        <ListEmpty
          icon={<Factory className="h-4 w-4 text-muted-foreground" aria-hidden />}
          title="Sin empresas"
          description="Aún no hay empresas operativas en la plataforma."
        />
      ) : listState.kind === 'filtered-empty' ? (
        <ListNoResults
          description={
            view === 'attention' && !debouncedSearch
              ? 'Ninguna empresa necesita atención.'
              : 'No hay empresas que coincidan.'
          }
          onClear={handleClearFilters}
        />
      ) : (
        <ListTableCard
          footer={
            <ListFooter total={rows.length} shown={filteredRows.length} noun="empresas" />
          }
        >
          <ListTable
            table={table}
            ariaLabel="Flota de empresas"
            rowTestId="operator-fleet-row"
            busy={refreshing}
            getRowHref={(row) => operatorConsoleCompanyHref(row.original.id)}
          />
        </ListTableCard>
      )}
    </div>
  );

  return <DesktopSwitch phone={phone} desktop={desktop} />;
};
