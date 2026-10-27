'use client';

import React from 'react';
import Link from 'next/link';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
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
import { createOperatorFleetColumns } from '@/components/operator-console/operator-company-fleet-columns';
import { DesktopSwitch } from '@/components/desktop-switch';
import {
  ListEmpty,
  ListError,
  ListFilterSelect,
  ListFooter,
  ListLoading,
  ListNoResults,
  ListRowMenu,
  ListTable,
  ListTableCard,
  ListToolbar,
} from '@/components/list-page';
import { resolveResourceListState } from '@/lib/resource-list-state';
import {
  OPERATOR_CONSOLE_COMPANY_QUERY_PARAM,
  operatorConsoleCompanyHref,
  operatorTenantHref,
} from '@/lib/operator-tenant-scope';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Factory, X, Plus } from 'lucide-react';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import type { OperatorFleetRow } from '@/lib/company-operator-fleet';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'setup' | 'active' | 'suspended' | 'archived';

/** The desktop pill reads «Todos los estados» at rest (ZIG-I33 §2). */
const FLEET_STATUS_SELECT_OPTIONS = FLEET_STATUS_FILTER_OPTIONS.map((option) =>
  option.value === 'all' ? { ...option, label: 'Todos los estados' } : option,
);

/** «Nueva empresa» opens the create page (it pointed at /companies/create, which does not exist). */
const NEW_COMPANY_HREF = '/companies/new';

const matchesStatusFilter = (
  lifecycle: OperatorFleetRow['lifecycle'],
  filter: StatusFilter,
): boolean => {
  if (filter === 'setup') return lifecycle === 'SETUP';
  if (filter === 'active') return lifecycle === 'ACTIVE';
  if (filter === 'suspended') return lifecycle === 'SUSPENDED';
  if (filter === 'archived') return lifecycle === 'ARCHIVED';
  return true;
};

const formatWhen = (iso: string | null): string => {
  if (!iso) return 'Sin registro';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Sin registro';
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
};

export const OperatorCompanyFleet = () => {
  const { selectedCompany, setSelectedCompany } = useCompany();
  const permissions = usePermissions();
  const canWriteCompanies =
    permissions.isSystem && permissions.can(PERMISSIONS.companies.write);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = React.useState<OperatorFleetRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'name', desc: false },
  ]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(searchValue.trim()),
      300,
    );
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const fetchFleet = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getOperatorCompanyFleet();
      if (result.success && result.data) {
        setRows(result.data);
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        setLoadError(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudo cargar la flota de empresas',
          ),
        );
      }
    } catch (error) {
      const errorType = classifyClientError(error);
      setLoadError(
        getErrorMessageByType(
          errorType,
          'No se pudo cargar la flota de empresas',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchFleet();
  }, [fetchFleet]);

  const filteredRows = React.useMemo(() => {
    const search = debouncedSearch.toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !search ||
        row.name.toLowerCase().includes(search) ||
        row.email.toLowerCase().includes(search) ||
        row.phone.toLowerCase().includes(search);
      if (!matchesSearch) return false;
      return matchesStatusFilter(row.lifecycle, statusFilter);
    });
  }, [rows, debouncedSearch, statusFilter]);

  const handleSelectContext = React.useCallback(
    (row: OperatorFleetRow) => {
      setSelectedCompany({
        id: row.id,
        name: row.name,
        logo: () => null,
        logoUrl: row.logo,
        plan: '',
        is_system: false,
      });
      router.replace(operatorConsoleCompanyHref(row.id), { scroll: false });
      window.requestAnimationFrame(() => {
        document
          .getElementById('operator-console-detail')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [router, setSelectedCompany],
  );

  React.useEffect(() => {
    if (rows.length === 0) {
      return;
    }
    const raw = searchParams.get(OPERATOR_CONSOLE_COMPANY_QUERY_PARAM);
    if (!raw) {
      return;
    }
    const companyId = Number.parseInt(raw, 10);
    if (!Number.isFinite(companyId) || selectedCompany?.id === companyId) {
      return;
    }
    const row = rows.find((entry) => entry.id === companyId);
    if (!row) {
      return;
    }
    setSelectedCompany({
      id: row.id,
      name: row.name,
      logo: () => null,
      logoUrl: row.logo,
      plan: '',
      is_system: false,
    });
  }, [rows, searchParams, selectedCompany?.id, setSelectedCompany]);

  const columns = React.useMemo(
    () =>
      createOperatorFleetColumns({
        formatWhen,
        renderContextBadge: (row) =>
          selectedCompany?.id === row.id ? (
            <Badge variant="secondary" className="w-fit text-caption">
              Actual
            </Badge>
          ) : (
            null
          ),
        renderActions: (row) => (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              aria-label={`Seleccionar contexto ${row.name}`}
              onClick={(event) => {
                event.stopPropagation();
                handleSelectContext(row);
              }}
            >
              Seleccionar
            </Button>
            {canWriteCompanies ? (
              <ListRowMenu
                label={`Acciones de ${row.name}`}
                items={[
                  {
                    label: 'Editar',
                    icon: <Pencil className="h-4 w-4" aria-hidden />,
                    onSelect: () =>
                      router.push(operatorTenantHref(row.editHref, row.id)),
                  },
                ]}
              />
            ) : null}
          </>
        ),
      }),
    [canWriteCompanies, handleSelectContext, router, selectedCompany?.id],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sheetFilterCount = statusFilter !== 'all' ? 1 : 0;
  const hasActiveFilters = debouncedSearch !== '' || statusFilter !== 'all';
  const listState = resolveResourceListState({
    isLoading: loading,
    loadError,
    totalCount: rows.length,
    visibleCount: table.getRowModel().rows.length,
    hasActiveFilters,
  });

  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setStatusFilter('all');
  };

  const activeStatusLabel =
    FLEET_STATUS_FILTER_OPTIONS.find((option) => option.value === statusFilter)
      ?.label ?? statusFilter;

  const filterChips = [
    {
      key: 'count',
      label: `${table.getRowModel().rows.length} de ${rows.length} empresas`,
      variant: 'secondary' as const,
    },
    ...(statusFilter !== 'all'
      ? [
          {
            key: 'status',
            label: activeStatusLabel,
          },
        ]
      : []),
    ...(debouncedSearch
      ? [{ key: 'search', label: `Búsqueda: ${debouncedSearch}` }]
      : []),
  ];

  const phone = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Flota de empresas
          </h2>
          <p className="text-sm text-muted-foreground">
            Estado, preparación e incidentes de cada tenant operativo.
          </p>
        </div>
        {canWriteCompanies ? (
          <Button
            className="min-h-11 rounded-xl"
            onClick={() => router.push(NEW_COMPANY_HREF)}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Nueva empresa
          </Button>
        ) : null}
      </div>

      <CompaniesFilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOptions={FLEET_STATUS_FILTER_OPTIONS}
        showSort={false}
        sheetFilterCount={sheetFilterCount}
        hasActiveFilters={hasActiveFilters}
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

      {listState.kind === 'loading' ? (
        <TripledListLoadingState label="Cargando flota de empresas…" />
      ) : null}
      {listState.kind === 'error' ? (
        <p className="text-sm text-destructive" role="alert">
          {listState.message}
        </p>
      ) : null}
      {listState.kind === 'empty' || listState.kind === 'filtered-empty' ? (
        <TripledEmptyState
          icon={<Factory className="h-4 w-4" aria-hidden />}
          title={
            listState.kind === 'filtered-empty'
              ? 'Sin coincidencias'
              : 'Sin empresas'
          }
          description={
            listState.kind === 'filtered-empty'
              ? 'No hay tenants que coincidan con el filtro.'
              : 'Aún no hay tenants operativos en la plataforma.'
          }
        />
      ) : null}

      {listState.kind === 'ready' ? (
        <>
          <div className="space-y-3">
            {table.getRowModel().rows.map((tableRow) => {
              const row = tableRow.original;
              const isCurrent = selectedCompany?.id === row.id;
              return (
                <TripledMobileRecordCard
                  key={row.id}
                  interactive
                  className={cn(
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isCurrent && 'ring-2 ring-primary/40',
                  )}
                  tabIndex={0}
                  role="button"
                  aria-label={`Seleccionar contexto ${row.name}`}
                  onClick={() => handleSelectContext(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelectContext(row);
                    }
                  }}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">{row.name}</h3>
                        <p className="text-caption text-muted-foreground">
                          {row.email}
                        </p>
                      </div>
                      {isCurrent ? (
                        <Badge variant="secondary">Actual</Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant={
                          row.lifecycle === 'ACTIVE' ? 'default' : 'secondary'
                        }
                      >
                        {row.lifecycleLabel}
                      </Badge>
                      {row.productionReady ? (
                        <Badge variant="default">Lista</Badge>
                      ) : (
                        <Badge variant="secondary">
                          {row.missingCount} pendientes
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-caption text-muted-foreground">
                      <p>Actividad: {formatWhen(row.lastActivityAt)}</p>
                      <p>
                        Incidente:{' '}
                        {row.lastIncidentLabel
                          ? `${row.lastIncidentLabel} · ${formatWhen(row.lastIncidentAt)}`
                          : '—'}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full"
                        aria-label={`Seleccionar contexto ${row.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSelectContext(row);
                        }}
                      >
                        Seleccionar
                      </Button>
                      {canWriteCompanies ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11 w-full"
                          aria-label={`Editar ${row.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(operatorTenantHref(row.editHref, row.id));
                          }}
                        >
                          <Pencil
                            className="mr-2 h-4 w-4"
                            aria-hidden
                            data-icon="inline-start"
                          />
                          Editar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </TripledMobileRecordCard>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );

  const visibleCount = table.getRowModel().rows.length;

  const desktop = (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">
            Flota de empresas
            {listState.kind === 'loading' || listState.kind === 'error' ? null : (
              <span className="font-normal text-muted-foreground">
                {' · '}
                <span className="tabular-nums">{rows.length}</span>
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado, preparación e incidentes de cada tenant operativo.
          </p>
        </div>
        {canWriteCompanies ? (
          <Button asChild className="shrink-0">
            <Link href={NEW_COMPANY_HREF}>
              <Plus className="h-4 w-4" aria-hidden data-icon="inline-start" />
              Nueva empresa
            </Link>
          </Button>
        ) : null}
      </div>

      <ListToolbar
        search={{
          value: searchValue,
          onChange: setSearchValue,
          placeholder: 'Buscar empresa, correo o teléfono',
          ariaLabel: 'Buscar empresas',
        }}
        filters={
          <ListFilterSelect
            value={statusFilter}
            allValue="all"
            onChange={setStatusFilter}
            options={FLEET_STATUS_SELECT_OPTIONS}
            ariaLabel="Filtrar por estado"
          />
        }
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
          description="Aún no hay tenants operativos en la plataforma."
        />
      ) : listState.kind === 'filtered-empty' ? (
        <ListNoResults
          description="No hay tenants que coincidan con el filtro."
          onClear={handleClearFilters}
        />
      ) : (
        <ListTableCard
          footer={<ListFooter total={rows.length} shown={visibleCount} noun="empresas" />}
        >
          <ListTable
            table={table}
            ariaLabel="Flota de empresas"
            rowTestId="operator-fleet-row"
            onOpenRow={(row) => handleSelectContext(row.original)}
            isRowSelected={(row) => selectedCompany?.id === row.original.id}
          />
        </ListTableCard>
      )}
    </div>
  );

  return <DesktopSwitch phone={phone} desktop={desktop} />;
};
