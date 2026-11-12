'use client';

import React from 'react';
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Company } from '@/db/schema';
import { getCompanies } from '@/actions/companies';
import { useCompany } from '@/contexts/company-context';
import {
  TripledEmptyState,
  TripledListLoadingState,
  TripledMobileRecordCard,
} from '@/components/tripled';
import { resolveResourceListState } from '@/lib/resource-list-state';
import { Button } from '@/components/ui/button';
import { DesktopSwitch } from '@/components/desktop-switch';
import {
  LIST_PAGE_SIZE,
  ListDesktopTitle,
  ListEmpty,
  ListError,
  ListFooter,
  ListLoading,
  ListNoResults,
  ListRowMenu,
  ListTable,
  ListTableCard,
  listFooterPagination,
} from '@/components/list-page';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Factory, Globe2, Plus } from 'lucide-react';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { formatCompanyAddressOneLine } from '@/lib/company-address';
import { DeleteCompanyDialog } from '@/app/(app)/companies/delete-company-dialog';
import { createCompaniesColumns } from '@/components/companies/companies-columns';
import {
  CompaniesFilterBar,
  COMPANIES_STATUS_FILTER_OPTIONS,
  type CompaniesStatusFilter,
} from '@/components/companies/companies-filter-bar';
import { DEFAULT_COMPANY_SORTING } from '@/components/companies/companies-sort-presets';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
import {
  companyLifecycleLabel,
  normalizeCompanyLifecycleStatus,
} from '@/lib/company-lifecycle';
import { assessCompanyReadiness } from '@/lib/company-readiness';

export type CompaniesListRowClickAction = 'edit' | 'select';

type CompaniesListProps = {
  /**
   * Operator console should select company context on row activation.
   * Companies admin page keeps the default edit navigation.
   */
  rowClickAction?: CompaniesListRowClickAction;
};

const COMPANIES_DESCRIPTION = 'Administra las empresas disponibles en el sistema';

const statusLabel = (status: Company['status']) =>
  companyLifecycleLabel(status);

const matchesStatusFilter = (
  status: Company['status'],
  filter: CompaniesStatusFilter,
): boolean => {
  const lifecycle = normalizeCompanyLifecycleStatus(status);
  if (filter === 'setup') {
    return lifecycle === 'SETUP';
  }
  if (filter === 'active') {
    return lifecycle === 'ACTIVE';
  }
  if (filter === 'restricted') {
    return lifecycle === 'SUSPENDED' || lifecycle === 'ARCHIVED';
  }
  return true;
};

export function CompaniesList({
  rowClickAction = 'edit',
}: CompaniesListProps = {}) {
  const { selectedCompany, setSelectedCompany } = useCompany();
  const permissions = usePermissions();
  const canWriteCompanies =
    permissions.isSystem && permissions.can(PERMISSIONS.companies.write);
  const router = useRouter();
  type CompanyListRow = Company & {
    users?: Array<{ deleted_at?: Date | null }>;
  };
  const [companies, setCompanies] = React.useState<CompanyListRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<CompaniesStatusFilter>('all');
  const [sorting, setSorting] =
    React.useState<SortingState>(DEFAULT_COMPANY_SORTING);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [companyToDelete, setCompanyToDelete] = React.useState<Company | null>(
    null,
  );

  const selectOnRowClick = rowClickAction === 'select';
  const rowIsInteractive = selectOnRowClick
    ? permissions.isSystem
    : canWriteCompanies;

  React.useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(searchValue.trim()),
      300,
    );
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const fetchCompanies = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getCompanies();
      if (result.success && result.data) {
        setCompanies((result.data as CompanyListRow[]) ?? []);
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        setLoadError(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudieron cargar las empresas',
          ),
        );
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      const errorType = classifyClientError(error);
      setLoadError(
        getErrorMessageByType(
          errorType,
          'No se pudieron cargar las empresas',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const filteredCompanies = React.useMemo(() => {
    const search = debouncedSearch.toLowerCase();
    return companies.filter((companyRow) => {
      const matchesSearch =
        !search ||
        companyRow.name.toLowerCase().includes(search) ||
        companyRow.email.toLowerCase().includes(search) ||
        companyRow.phone.toLowerCase().includes(search);

      if (!matchesSearch) {
        return false;
      }

      return matchesStatusFilter(companyRow.status, statusFilter);
    });
  }, [companies, debouncedSearch, statusFilter]);

  const systemCompanyId = React.useMemo(
    () => selectedCompany?.id ?? null,
    [selectedCompany?.id],
  );

  const openDeleteDialog = React.useCallback((company: Company) => {
    setCompanyToDelete(company);
    setDeleteDialogOpen(true);
  }, []);

  const renderContextBadge = React.useCallback(
    (companyRow: Company) => {
      if (companyRow.is_system) {
        return (
          <Badge variant="outline" className="gap-1 text-caption">
            <Globe2 className="h-3 w-3" />
            Sistema
          </Badge>
        );
      }
      if (systemCompanyId === companyRow.id) {
        return (
          <Badge variant="secondary" className="text-caption">
            Actual
          </Badge>
        );
      }
      return (
        <span className="text-caption text-muted-foreground">&nbsp;</span>
      );
    },
    [systemCompanyId],
  );

  const isSystemUser = permissions.isSystem;

  const buildContextCompany = React.useCallback(
    (companyRow: CompanyListRow) => ({
      id: companyRow.id,
      name: companyRow.name,
      logo: () => null,
      logoUrl: companyRow.logo,
      plan: '',
      is_system: companyRow.is_system,
    }),
    [],
  );

  const getReadinessBadge = React.useCallback((companyRow: CompanyListRow) => {
    const readiness = assessCompanyReadiness(companyRow);
    if (readiness.productionReady) {
      return <Badge variant="default">Lista</Badge>;
    }
    return <Badge variant="secondary">Con pendientes</Badge>;
  }, []);

  const handleSelectContext = React.useCallback(
    (companyRow: CompanyListRow) => {
      setSelectedCompany(buildContextCompany(companyRow));
    },
    [buildContextCompany, setSelectedCompany],
  );

  const handleRowActivate = React.useCallback(
    (companyRow: CompanyListRow) => {
      if (selectOnRowClick) {
        if (!permissions.isSystem) {
          return;
        }
        handleSelectContext(companyRow);
        return;
      }
      if (!canWriteCompanies) {
        return;
      }
      router.push(`/companies/${companyRow.id}/edit`);
    },
    [
      canWriteCompanies,
      handleSelectContext,
      permissions.isSystem,
      router,
      selectOnRowClick,
    ],
  );

  // Desktop rows (ZIG-I33 §5): Seleccionar stays visible for operators, edit and
  // delete live in the ⋯ with Eliminar last. Nothing appears on hover.
  const columns = React.useMemo(
    () =>
      createCompaniesColumns({
        renderContextBadge,
        actionsClassName: isSystemUser ? 'w-44' : 'w-12',
        renderActions: (companyRow) =>
          canWriteCompanies || isSystemUser ? (
            <div className="flex items-center justify-end gap-1">
              {isSystemUser ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  aria-label={`Seleccionar contexto ${companyRow.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSelectContext(companyRow);
                  }}
                >
                  Seleccionar
                </Button>
              ) : null}
              <ListRowMenu
                label={`Acciones de ${companyRow.name}`}
                items={[
                  {
                    label: 'Editar',
                    icon: <Pencil className="h-4 w-4" aria-hidden />,
                    onSelect: () => router.push(`/companies/${companyRow.id}/edit`),
                  },
                  {
                    label: 'Eliminar',
                    icon: <Trash2 className="h-4 w-4" aria-hidden />,
                    onSelect: () => openDeleteDialog(companyRow),
                    destructive: true,
                  },
                ]}
              />
            </div>
          ) : null,
      }),
    [
      router,
      openDeleteDialog,
      renderContextBadge,
      canWriteCompanies,
      isSystemUser,
      handleSelectContext,
    ],
  );

  const table = useReactTable({
    data: filteredCompanies,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    initialState: { pagination: { pageIndex: 0, pageSize: LIST_PAGE_SIZE } },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  // Phones list every company, as before; only the desktop table pages at 25.
  const phoneRows = table.getPrePaginationRowModel().rows;

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const rowCount = filteredCompanies.length;
  const sheetFilterCount = statusFilter !== 'all' ? 1 : 0;
  const hasActiveFilters = debouncedSearch !== '' || statusFilter !== 'all';
  const listState = resolveResourceListState({
    isLoading: loading,
    loadError,
    totalCount: companies.length,
    visibleCount: rowCount,
    hasActiveFilters,
  });
  const activeStatusLabel =
    COMPANIES_STATUS_FILTER_OPTIONS.find((option) => option.value === statusFilter)?.label ??
    'Todas';

  // A refetch keeps the desktop table, dimmed (ZIG-I33 §8).
  const desktopListState = resolveResourceListState({
    isLoading: loading && companies.length === 0,
    loadError,
    totalCount: companies.length,
    visibleCount: rowCount,
    hasActiveFilters,
  });
  const paged = table.getPageCount() > 1;

  // Limpiar clears filters and search, never the sort (ZIG-I33 §2).
  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setStatusFilter('all');
  };

  const filterChips = [
    {
      key: 'count',
      label: `${rowCount} de ${companies.length} empresas`,
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
      ? [
          {
            key: 'search',
            label: `Búsqueda: ${debouncedSearch}`,
          },
        ]
      : []),
  ];

  const filterBar = (
    <CompaniesFilterBar
      desktopPills
      searchValue={searchValue}
      onSearchChange={handleSearchChange}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      statusOptions={COMPANIES_STATUS_FILTER_OPTIONS}
      sorting={sorting}
      onSortingChange={setSorting}
      sheetFilterCount={sheetFilterCount}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={handleClearFilters}
      filterChips={filterChips}
    />
  );

  const emptyDescription = canWriteCompanies
    ? 'Crea la primera empresa para separar usuarios, permisos y operación por contexto.'
    : 'No hay empresas registradas todavía.';

  const phone = (
    <div className="space-y-4">
      {filterBar}

      {listState.kind === 'loading' ? (
        <TripledListLoadingState
          label="Cargando lista de empresas"
          desktopColumns={6}
          desktopRows={5}
        />
      ) : listState.kind === 'error' ? (
        <TripledEmptyState
          icon={<Factory className="h-4 w-4" />}
          title="Error de carga"
          description={listState.message}
          role="alert"
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void fetchCompanies();
              }}
            >
              Reintentar
            </Button>
          }
        />
      ) : listState.kind === 'empty' ? (
        <TripledEmptyState
          icon={<Factory className="h-4 w-4" />}
          title="Sin empresas"
          description={emptyDescription}
          action={
            canWriteCompanies ? (
              <Button
                type="button"
                onClick={() => router.push('/companies/new')}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
                Nueva empresa
              </Button>
            ) : null
          }
        />
      ) : listState.kind === 'filtered-empty' ? (
        <TripledEmptyState
          icon={<Factory className="h-4 w-4" />}
          title="Sin resultados"
          description="No encontramos empresas con esa búsqueda o esos filtros."
          action={
            <Button type="button" variant="outline" onClick={handleClearFilters}>
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {phoneRows.map((row) => {
            const companyRow = row.original;
            return (
              <TripledMobileRecordCard
                key={row.id}
                interactive={rowIsInteractive}
                className={
                  rowIsInteractive
                    ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    : undefined
                }
                tabIndex={rowIsInteractive ? 0 : -1}
                role="button"
                aria-label={
                  selectOnRowClick
                    ? `Seleccionar contexto ${companyRow.name}`
                    : canWriteCompanies
                      ? `Editar empresa ${companyRow.name}`
                      : `Empresa ${companyRow.name}`
                }
                onClick={() => {
                  handleRowActivate(companyRow);
                }}
                onKeyDown={(event) => {
                  if (
                    rowIsInteractive &&
                    (event.key === 'Enter' || event.key === ' ')
                  ) {
                    event.preventDefault();
                    handleRowActivate(companyRow);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {companyRow.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={
                          normalizeCompanyLifecycleStatus(companyRow.status) ===
                          'ARCHIVED'
                            ? 'destructive'
                            : companyRow.status === 'ACTIVE'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {statusLabel(companyRow.status)}
                      </Badge>
                      {getReadinessBadge(companyRow)}
                      {renderContextBadge(companyRow)}
                    </div>
                  </div>
                  {canWriteCompanies || isSystemUser ? (
                    <div className="flex shrink-0 gap-1">
                      {isSystemUser ? (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Seleccionar contexto ${companyRow.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSelectContext(companyRow);
                          }}
                        >
                          Seleccionar
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${companyRow.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/companies/${companyRow.id}/edit`);
                        }}
                      >
                        <Pencil className="h-4 w-4" data-icon="inline-start" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar ${companyRow.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openDeleteDialog(companyRow);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" data-icon="inline-start" />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="grid grid-cols-[88px_1fr] gap-2">
                    <dt className="text-muted-foreground">Teléfono</dt>
                    <dd className="truncate tabular-nums">
                      {companyRow.phone}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[88px_1fr] gap-2">
                    <dt className="text-muted-foreground">Correo</dt>
                    <dd className="truncate">{companyRow.email}</dd>
                  </div>
                  <div className="grid grid-cols-[88px_1fr] gap-2">
                    <dt className="text-muted-foreground">Dirección</dt>
                    <dd className="line-clamp-2">
                      {formatCompanyAddressOneLine(companyRow)}
                    </dd>
                  </div>
                </dl>
              </TripledMobileRecordCard>
            );
          })}
        </div>
      )}
    </div>
  );

  const createButton = canWriteCompanies ? (
    <Button asChild>
      <Link href="/companies/new">
        <Plus className="h-4 w-4 shrink-0" aria-hidden data-icon="inline-start" />
        Nueva empresa
      </Link>
    </Button>
  ) : null;

  const desktop = (
    <>
      <ListDesktopTitle
        title="Empresas"
        count={loading && companies.length === 0 ? null : companies.length}
        description={COMPANIES_DESCRIPTION}
        actions={createButton}
      />
      <div className="space-y-4">
        {filterBar}
        {desktopListState.kind === 'loading' ? (
          <ListLoading label="Cargando lista de empresas" columns={7} />
        ) : desktopListState.kind === 'error' ? (
          <ListError
            description={desktopListState.message}
            onRetry={() => {
              void fetchCompanies();
            }}
          />
        ) : desktopListState.kind === 'empty' ? (
          <ListEmpty
            icon={<Factory className="h-4 w-4 text-muted-foreground" aria-hidden />}
            title="Sin empresas"
            description={emptyDescription}
            action={createButton}
          />
        ) : desktopListState.kind === 'filtered-empty' ? (
          <ListNoResults
            description="No encontramos empresas con esa búsqueda o esos filtros."
            onClear={handleClearFilters}
          />
        ) : (
          <ListTableCard
            footer={
              <ListFooter
                total={paged ? rowCount : companies.length}
                shown={rowCount}
                noun="empresas"
                pagination={listFooterPagination(table, { pageSizes: false })}
              />
            }
          >
            <ListTable
              table={table}
              ariaLabel="Empresas"
              busy={loading}
              onOpenRow={rowIsInteractive ? (row) => handleRowActivate(row.original) : undefined}
              rowTestId="companies-row"
            />
          </ListTableCard>
        )}
      </div>
    </>
  );

  return (
    <>
      <DesktopSwitch phone={phone} desktop={desktop} />

      {companyToDelete ? (
        <DeleteCompanyDialog
          company={companyToDelete}
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setCompanyToDelete(null);
            }
          }}
          onDeleted={() => {
            void fetchCompanies();
          }}
        />
      ) : null}
    </>
  );
}
