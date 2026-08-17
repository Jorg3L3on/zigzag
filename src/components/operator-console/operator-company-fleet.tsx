'use client';

import React from 'react';
import {
  flexRender,
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
import { resolveResourceListState } from '@/lib/resource-list-state';
import {
  OPERATOR_CONSOLE_COMPANY_QUERY_PARAM,
  operatorConsoleCompanyHref,
  operatorTenantHref,
} from '@/lib/operator-tenant-scope';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Factory, X, Plus } from 'lucide-react';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import type { OperatorFleetRow } from '@/lib/company-operator-fleet';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'setup' | 'active' | 'suspended' | 'archived';

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
      250,
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
            <Badge variant="secondary" className="w-fit text-xs">
              Actual
            </Badge>
          ) : (
            <span className="sr-only"> </span>
          ),
        renderActions: (row) => (
          <>
            <Button
              variant="outline"
              size="sm"
              className="mr-1"
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
                variant="ghost"
                size="icon"
                aria-label={`Editar ${row.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  router.push(operatorTenantHref(row.editHref, row.id));
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
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

  return (
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
            onClick={() => router.push('/companies/create')}
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
          <div className="space-y-3 md:hidden">
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
                        <p className="text-xs text-muted-foreground">
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
                    <div className="space-y-1 text-xs text-muted-foreground">
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

          <div className="hidden overflow-hidden rounded-xl border border-border/70 md:block">
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
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((tableRow) => {
                  const row = tableRow.original;
                  const isCurrent = selectedCompany?.id === row.id;
                  return (
                    <TableRow
                      key={tableRow.id}
                      className={cn(
                        'cursor-pointer',
                        isCurrent && 'bg-muted/40',
                      )}
                      onClick={() => handleSelectContext(row)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleSelectContext(row);
                        }
                      }}
                      tabIndex={0}
                      aria-label={`Seleccionar contexto ${row.name}`}
                    >
                      {tableRow.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </div>
  );
};
