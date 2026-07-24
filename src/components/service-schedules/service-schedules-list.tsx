'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { CalendarClock, Plus, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  deleteClientServiceSchedule,
  listClientServiceSchedules,
  pauseClientServiceSchedule,
  resumeClientServiceSchedule,
  type ClientServiceScheduleListItem,
} from '@/actions/client-service-schedules';
import { useCompany } from '@/contexts/company-context';
import {
  TripledEmptyState,
  TripledListLoadingState,
  TripledMobileRecordCard,
} from '@/components/tripled';
import { resolveResourceListState } from '@/lib/resource-list-state';
import { createServiceSchedulesColumns } from '@/components/service-schedules/service-schedules-columns';
import { ScheduleFormDialog } from '@/components/service-schedules/schedule-form-dialog';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import { usePermissions } from '@/hooks/use-permissions';
import type { ScheduleFilterBucket } from '@/lib/schedule-buckets';
import { isScheduleFilterBucket } from '@/lib/schedule-buckets';
import { FormattedDate } from '@/components/formatted-date';
import { formatScheduleInterval } from '@/lib/schedule-interval-presets';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { canCreateTicketFromSchedule, canReadServiceSchedules, canWriteServiceSchedules, needsSelectedCompanyForSchedules } from '@/lib/service-schedules-rbac';

const FILTER_OPTIONS: Array<{ value: ScheduleFilterBucket; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'proximos', label: 'Próximos' },
  { value: 'atrasados', label: 'Atrasados' },
  { value: 'programados', label: 'Programados' },
  { value: 'pausados', label: 'Pausados' },
];

const DEFAULT_SORTING: SortingState = [{ id: 'nextDueAt', desc: false }];

export const ServiceSchedulesList = () => {
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const canRead = canReadServiceSchedules(permissions.can);
  const canWrite = canWriteServiceSchedules(permissions.can);
  const canCreateTicket = canCreateTicketFromSchedule(permissions.can);
  const missingCompany = needsSelectedCompanyForSchedules(
    permissions.isSystem,
    selectedCompany?.id,
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = React.useState<ClientServiceScheduleListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<ScheduleFilterBucket>(() => {
    const raw = searchParams.get('filter');
    return raw && isScheduleFilterBucket(raw) ? raw : 'todos';
  });
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [sorting, setSorting] = React.useState<SortingState>(DEFAULT_SORTING);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] =
    React.useState<ClientServiceScheduleListItem | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<ClientServiceScheduleListItem | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  React.useEffect(() => {
    const raw = searchParams.get('filter');
    const next = raw && isScheduleFilterBucket(raw) ? raw : 'todos';
    setFilter(next);
  }, [searchParams]);

  React.useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === 'todos') {
      params.delete('filter');
    } else {
      params.set('filter', filter);
    }
    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) {
      return;
    }
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [filter, pathname, router, searchParams]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(searchValue.trim().toLowerCase()),
      250,
    );
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const loadSchedules = React.useCallback(async () => {
    if (!canRead || missingCompany) {
      setLoading(false);
      setItems([]);
      setLoadError(
        missingCompany
          ? 'Selecciona una empresa para ver recordatorios.'
          : null,
      );
      return;
    }

    setLoading(true);
    setLoadError(null);
    const result = await listClientServiceSchedules({
      companyId: selectedCompany?.id ?? null,
      filter,
    });
    setLoading(false);
    if (!result.success || !result.data) {
      const errorType = classifyClientError(null, undefined, result.errorType);
      setLoadError(
        getErrorMessageByType(
          errorType,
          result.error || 'No se pudieron cargar los recordatorios',
        ),
      );
      setItems([]);
      return;
    }
    setItems(result.data);
  }, [canRead, filter, missingCompany, selectedCompany?.id]);

  React.useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const filteredItems = React.useMemo(() => {
    if (!debouncedSearch) {
      return items;
    }
    return items.filter((item) => {
      const haystack =
        `${item.clientName} ${item.serviceName}`.toLowerCase();
      return haystack.includes(debouncedSearch);
    });
  }, [items, debouncedSearch]);

  const handleEdit = React.useCallback((schedule: ClientServiceScheduleListItem) => {
    setEditing(schedule);
    setFormOpen(true);
  }, []);

  const handleAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handlePause = React.useCallback(
    async (schedule: ClientServiceScheduleListItem) => {
      setActionLoading(true);
      const result = await pauseClientServiceSchedule(
        schedule.id,
        null,
        selectedCompany?.id ?? null,
      );
      setActionLoading(false);
      if (result.success) {
        toast.success('Recordatorio pausado');
        void loadSchedules();
      } else {
        toast.error(result.error || 'No se pudo pausar');
      }
    },
    [loadSchedules, selectedCompany?.id],
  );

  const handleResume = React.useCallback(
    async (schedule: ClientServiceScheduleListItem) => {
      setActionLoading(true);
      const result = await resumeClientServiceSchedule(
        schedule.id,
        selectedCompany?.id ?? null,
      );
      setActionLoading(false);
      if (result.success) {
        toast.success('Recordatorio reanudado');
        void loadSchedules();
      } else {
        toast.error(result.error || 'No se pudo reanudar');
      }
    },
    [loadSchedules, selectedCompany?.id],
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setActionLoading(true);
    const result = await deleteClientServiceSchedule(
      deleteTarget.id,
      selectedCompany?.id ?? null,
    );
    setActionLoading(false);
    setDeleteTarget(null);
    if (result.success) {
      toast.success('Recordatorio eliminado');
      void loadSchedules();
    } else {
      toast.error(result.error || 'No se pudo eliminar');
    }
  };

  const columns = React.useMemo(
    () =>
      createServiceSchedulesColumns({
        canWrite,
        canCreateTicket,
        onEdit: handleEdit,
        onPause: (schedule) => void handlePause(schedule),
        onResume: (schedule) => void handleResume(schedule),
        onDelete: setDeleteTarget,
      }),
    [canCreateTicket, canWrite, handleEdit, handlePause, handleResume],
  );

  const table = useReactTable({
    data: filteredItems,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const hasActiveFilters = debouncedSearch !== '' || filter !== 'todos';
  const listState = resolveResourceListState({
    isLoading: loading,
    loadError,
    totalCount: items.length,
    visibleCount: filteredItems.length,
    hasActiveFilters,
  });

  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setFilter('todos');
    setSorting(DEFAULT_SORTING);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="min-h-11 rounded-xl pl-9"
            placeholder="Buscar por cliente o servicio"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            aria-label="Buscar recordatorios"
          />
        </div>
        {canWrite ? (
          <Button
            type="button"
            className="min-h-11 gap-1.5 rounded-xl"
            onClick={handleAdd}
          >
            <Plus className="h-4 w-4" aria-hidden  data-icon="inline-start" />
            Nuevo recordatorio
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={filter === option.value ? 'default' : 'outline'}
            className="min-h-11 rounded-xl"
            onClick={() => setFilter(option.value)}
            aria-label={`Filtrar ${option.label}`}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {listState.kind === 'loading' ? (
        <TripledListLoadingState
          label="Cargando lista de recordatorios"
          desktopColumns={6}
          desktopRows={5}
        />
      ) : listState.kind === 'error' ? (
        <TripledEmptyState
          icon={<CalendarClock className="h-4 w-4" />}
          title="Error al cargar"
          description={listState.message}
          role="alert"
          action={
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => void loadSchedules()}
            >
              Reintentar
            </Button>
          }
        />
      ) : listState.kind === 'empty' ? (
        <TripledEmptyState
          icon={<CalendarClock className="h-4 w-4" />}
          title="Sin recordatorios"
          description={
            canWrite
              ? 'Crea el primer recordatorio para programar servicios recurrentes.'
              : 'No hay recordatorios registrados todavía.'
          }
          action={
            canWrite ? (
              <Button
                type="button"
                className="rounded-xl"
                onClick={handleAdd}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
                Nuevo recordatorio
              </Button>
            ) : null
          }
        />
      ) : listState.kind === 'filtered-empty' ? (
        <TripledEmptyState
          icon={<CalendarClock className="h-4 w-4" />}
          title="Sin resultados"
          description="No hay recordatorios que coincidan con la búsqueda o el filtro."
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
              const schedule = row.original;
              return (
                <TripledMobileRecordCard key={schedule.id}>
                  <div className="space-y-2">
                    <div>
                      <h3 className="text-sm font-semibold">{schedule.clientName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {schedule.serviceName}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {formatScheduleInterval(
                        schedule.intervalValue,
                        schedule.intervalUnit,
                      )}
                    </Badge>
                    <dl className="text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Próximo</dt>
                        <dd>
                          <FormattedDate date={new Date(schedule.nextDueAt)} />
                        </dd>
                      </div>
                    </dl>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {canCreateTicket ? (
                        <Button variant="outline" size="sm" className="rounded-lg" asChild>
                          <Link
                            href={`/tickets/create?clientId=${schedule.clientId}&serviceId=${schedule.serviceId}`}
                          >
                            Crear ticket
                          </Link>
                        </Button>
                      ) : null}
                      {canWrite ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => handleEdit(schedule)}
                        >
                          Editar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </TripledMobileRecordCard>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border md:block">
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
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <ScheduleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        schedule={editing}
        onSaved={() => void loadSchedules()}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar recordatorio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El recordatorio dejará de mostrarse en
              las listas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={() => void handleConfirmDelete()}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
