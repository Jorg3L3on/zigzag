'use client';

import React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import type { Company } from '@/db/schema';
import { getCompanies } from '@/actions/companies';
import { useCompany } from '@/contexts/company-context';
import {
  TripledEmptyState,
  TripledFilterChips,
  TripledListLoadingState,
  TripledMobileRecordCard,
} from '@/components/tripled';
import { resolveResourceListState } from '@/lib/resource-list-state';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Trash2, Factory, Globe2, Search, X, Plus } from 'lucide-react';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { formatCompanyAddressOneLine } from '@/lib/company-address';
import { DeleteCompanyDialog } from '@/app/(app)/companies/delete-company-dialog';
import { createCompaniesColumns } from '@/components/companies/companies-columns';
import {
  COMPANIES_MOBILE_SORT_OPTIONS,
  DEFAULT_COMPANY_SORTING,
  decodeSortingState,
  encodeSortingState,
} from '@/components/companies/companies-sort-presets';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
import {
  companyLifecycleLabel,
  normalizeCompanyLifecycleStatus,
} from '@/lib/company-lifecycle';
import { assessCompanyReadiness } from '@/lib/company-readiness';
import {
  COMPANY_PLAN_LABELS,
  getCompanyPlanId,
  getPlanLimits,
} from '@/lib/company-entitlements';

type StatusFilter = 'all' | 'setup' | 'active' | 'restricted';

const statusLabel = (status: Company['status']) =>
  companyLifecycleLabel(status);

const matchesStatusFilter = (
  status: Company['status'],
  filter: StatusFilter,
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

export function CompaniesList() {
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
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [sorting, setSorting] =
    React.useState<SortingState>(DEFAULT_COMPANY_SORTING);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [companyToDelete, setCompanyToDelete] = React.useState<Company | null>(
    null,
  );

  React.useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(searchValue.trim()),
      250,
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
          <Badge variant="outline" className="gap-1 text-xs">
            <Globe2 className="h-3 w-3" />
            Sistema
          </Badge>
        );
      }
      if (systemCompanyId === companyRow.id) {
        return (
          <Badge variant="secondary" className="text-xs">
            Actual
          </Badge>
        );
      }
      return (
        <span className="text-xs text-muted-foreground">&nbsp;</span>
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
      plan: COMPANY_PLAN_LABELS[getCompanyPlanId(companyRow.settings)],
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

  const getPlanPressureBadge = React.useCallback((companyRow: CompanyListRow) => {
    const plan = getCompanyPlanId(companyRow.settings);
    const userLimit = getPlanLimits(plan).users;
    const userUsage =
      companyRow.users?.filter((userRow) => userRow.deleted_at == null).length ?? 0;

    if (userLimit === null) {
      return <Badge variant="outline">Plan {COMPANY_PLAN_LABELS[plan]}: sin límite</Badge>;
    }

    const ratio = userLimit > 0 ? userUsage / userLimit : 0;
    if (ratio >= 1) {
      return (
        <Badge variant="destructive">
          Plan {COMPANY_PLAN_LABELS[plan]}: límite alcanzado ({userUsage}/{userLimit})
        </Badge>
      );
    }
    if (ratio >= 0.8) {
      return (
        <Badge variant="secondary" className="border-amber-200 bg-amber-100 text-amber-900">
          Plan {COMPANY_PLAN_LABELS[plan]}: cerca del límite ({userUsage}/{userLimit})
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        Plan {COMPANY_PLAN_LABELS[plan]}: estable ({userUsage}/{userLimit})
      </Badge>
    );
  }, []);

  const handleSelectContext = React.useCallback(
    (companyRow: CompanyListRow) => {
      setSelectedCompany(buildContextCompany(companyRow));
    },
    [buildContextCompany, setSelectedCompany],
  );

  const columns = React.useMemo(
    () =>
      createCompaniesColumns({
        renderContextBadge,
        renderActions: (companyRow) =>
          canWriteCompanies || isSystemUser ? (
            <>
            {isSystemUser ? (
              <Button
                variant="outline"
                size="sm"
                className="mr-2"
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
              <Pencil className="h-4 w-4" />
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
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
            </>
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
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'setup', label: 'En configuración' },
    { value: 'active', label: 'Activas' },
    { value: 'restricted', label: 'Suspendidas / archivadas' },
  ];

  const rowCount = table.getRowModel().rows.length;
  const mobileSortValue = encodeSortingState(sorting);
  const hasActiveFilters = debouncedSearch !== '' || statusFilter !== 'all';
  const listState = resolveResourceListState({
    isLoading: loading,
    loadError,
    totalCount: companies.length,
    visibleCount: rowCount,
    hasActiveFilters,
  });
  const activeStatusLabel =
    statusFilterOptions.find((option) => option.value === statusFilter)?.label ??
    'Todas';

  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setSorting(DEFAULT_COMPANY_SORTING);
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

  return (
    <div className="space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Buscar por nombre, correo o teléfono..."
            className="h-12 rounded-xl bg-muted/30 pl-9 shadow-none sm:h-11 sm:max-w-md sm:bg-background"
            aria-label="Buscar empresas"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {statusFilterOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={statusFilter === option.value ? 'default' : 'outline'}
                className="min-h-11 rounded-xl"
                onClick={() => setStatusFilter(option.value)}
                aria-label={`Filtrar por estado: ${option.label.toLowerCase()}`}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="w-full sm:w-auto md:hidden">
            <Select
              value={mobileSortValue}
              onValueChange={(value) => setSorting(decodeSortingState(value))}
            >
              <SelectTrigger
                className="h-11 w-full rounded-xl sm:w-[min(100%,18rem)]"
                aria-label="Ordenar lista de empresas"
              >
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                {COMPANIES_MOBILE_SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TripledFilterChips chips={filterChips} />
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 justify-start text-destructive hover:bg-destructive/10 hover:text-destructive sm:min-h-9"
              onClick={handleClearFilters}
              aria-label="Limpiar filtros de empresas"
            >
              <X className="mr-2 h-4 w-4" aria-hidden />
              Limpiar filtros
            </Button>
          ) : null}
        </div>

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
            description={
              canWriteCompanies
                ? 'Crea la primera empresa para separar usuarios, permisos y operación por contexto.'
                : 'No hay empresas registradas todavía.'
            }
            action={
              canWriteCompanies ? (
                <Button
                  type="button"
                  onClick={() => router.push('/companies/new')}
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
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
          <>
            <div className="space-y-3 md:hidden">
              {table.getRowModel().rows.map((row) => {
                const companyRow = row.original;
                return (
                  <TripledMobileRecordCard
                    key={row.id}
                    interactive={canWriteCompanies}
                    className={
                      canWriteCompanies
                        ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                        : undefined
                    }
                    tabIndex={canWriteCompanies ? 0 : -1}
                    role="button"
                    aria-label={
                      canWriteCompanies
                        ? `Editar empresa ${companyRow.name}`
                        : `Empresa ${companyRow.name}`
                    }
                    onClick={() => {
                      if (canWriteCompanies) {
                        router.push(`/companies/${companyRow.id}/edit`);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        canWriteCompanies &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        event.preventDefault();
                        router.push(
                          `/companies/${companyRow.id}/edit`,
                        );
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
                          {getPlanPressureBadge(companyRow)}
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
                            router.push(
                              `/companies/${companyRow.id}/edit`,
                            );
                          }}
                        >
                          <Pencil className="h-4 w-4" />
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
                          <Trash2 className="h-4 w-4 text-destructive" />
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

            <div className="hidden overflow-hidden rounded-xl border border-border/70 shadow-sm md:block">
              <Table
                className={
                  '[&_td]:py-2.5 [&_th]:h-10 [&_th]:py-2 [&_th]:align-middle [&_tr]:border-border/60'
                }
              >
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className={
                            header.column.id === 'actions' ||
                            header.column.id === 'context'
                              ? 'text-right'
                              : undefined
                          }
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
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={canWriteCompanies ? 'cursor-pointer' : undefined}
                      tabIndex={canWriteCompanies ? 0 : -1}
                      onClick={() => {
                        if (canWriteCompanies) {
                          router.push(
                            `/companies/${row.original.id}/edit`,
                          );
                        }
                      }}
                      onKeyDown={(event) => {
                        if (
                          canWriteCompanies &&
                          (event.key === 'Enter' || event.key === ' ')
                        ) {
                          event.preventDefault();
                          router.push(
                            `/companies/${row.original.id}/edit`,
                          );
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={
                            cell.column.id === 'actions' ||
                            cell.column.id === 'context'
                              ? 'text-right'
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

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
    </div>
  );
}
