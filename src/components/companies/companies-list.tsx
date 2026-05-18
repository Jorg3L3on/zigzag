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
  TripledDataPanel,
  TripledEmptyState,
} from '@/components/tripled';
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
import { Loader2, Pencil, Trash2, Factory, Globe2 } from 'lucide-react';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { formatCompanyAddressOneLine } from '@/lib/company-address';
import { DeleteCompanyDialog } from '@/app/dashboard/companies/delete-company-dialog';
import { createCompaniesColumns } from '@/components/companies/companies-columns';

type StatusFilter = 'all' | 'active' | 'inactive';

const DEFAULT_COMPANY_SORTING: SortingState = [{ id: 'name', desc: false }];

const statusLabel = (status: Company['status']) =>
  status === 'ACTIVE' ? 'Activa' : 'Inactiva';

const isActive = (status: Company['status']) => status === 'ACTIVE';

export function CompaniesList() {
  const { selectedCompany } = useCompany();
  const router = useRouter();
  const [companies, setCompanies] = React.useState<Company[]>([]);
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
        setCompanies(result.data);
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

      if (statusFilter === 'active') {
        return isActive(companyRow.status);
      }
      if (statusFilter === 'inactive') {
        return !isActive(companyRow.status);
      }

      return true;
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

  const columns = React.useMemo(
    () =>
      createCompaniesColumns({
        renderContextBadge,
        renderActions: (companyRow) => (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${companyRow.name}`}
              onClick={(event) => {
                event.stopPropagation();
                router.push(`/dashboard/companies/${companyRow.id}/edit`);
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
        ),
      }),
    [router, openDeleteDialog, renderContextBadge],
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

  const handleCreateCompanyClick = () => {
    router.push('/dashboard/companies/new');
  };

  const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'active', label: 'Activas' },
    { value: 'inactive', label: 'Inactivas' },
  ];

  const rowCount = table.getRowModel().rows.length;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <TripledDataPanel
        title="Empresas"
        description="Administra las empresas disponibles en el sistema."
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        ctaLabel="Nueva empresa"
        onCtaClick={handleCreateCompanyClick}
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {statusFilterOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={statusFilter === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(option.value)}
              aria-label={`Filtrar por estado: ${option.label.toLowerCase()}`}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <div className="space-y-4">
            <TripledEmptyState
              icon={<Factory className="h-4 w-4" />}
              title="Error de carga"
              description={loadError}
            />
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void fetchCompanies();
                }}
              >
                Reintentar
              </Button>
            </div>
          </div>
        ) : rowCount === 0 ? (
          <TripledEmptyState
            icon={<Factory className="h-4 w-4" />}
            title="Sin resultados"
            description={
              companies.length === 0
                ? 'No hay empresas registradas todavía.'
                : 'No encontramos empresas con ese filtro.'
            }
          />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {table.getRowModel().rows.map((row) => {
                const companyRow = row.original;
                return (
                  <article
                    key={row.id}
                    className="cursor-pointer rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    tabIndex={0}
                    role="button"
                    aria-label={`Editar empresa ${companyRow.name}`}
                    onClick={() =>
                      router.push(`/dashboard/companies/${companyRow.id}/edit`)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(
                          `/dashboard/companies/${companyRow.id}/edit`,
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
                              isActive(companyRow.status)
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {statusLabel(companyRow.status)}
                          </Badge>
                          {renderContextBadge(companyRow)}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar ${companyRow.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(
                              `/dashboard/companies/${companyRow.id}/edit`,
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
                  </article>
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
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() =>
                        router.push(
                          `/dashboard/companies/${row.original.id}/edit`,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(
                            `/dashboard/companies/${row.original.id}/edit`,
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
      </TripledDataPanel>

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
