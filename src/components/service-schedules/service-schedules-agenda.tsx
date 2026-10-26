'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from '@tanstack/react-table';
import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  bulkClientServiceSchedules,
  deleteClientServiceSchedule,
  listClientServiceScheduleServiceOptions,
  listClientServiceSchedulesPaginated,
  markClientServiceScheduleDone,
  pauseClientServiceSchedule,
  restoreClientServiceScheduleDates,
  resumeClientServiceSchedule,
  snoozeClientServiceSchedule,
  type ClientServiceScheduleAgendaItem,
  type ClientServiceScheduleDates,
  type ClientServiceScheduleListItem,
  type PaginatedClientServiceSchedulesData,
} from '@/actions/client-service-schedules';
import { useUndoToast } from '@/components/documents/use-undo-toast';
import { ScheduleFormDialog } from '@/components/service-schedules/schedule-form-dialog';
import {
  ScheduleMarkDoneDialog,
  SchedulePauseDialog,
  ScheduleSnoozeDateDialog,
} from '@/components/service-schedules/schedule-agenda-dialogs';
import type { ScheduleActionHandlers } from '@/components/service-schedules/schedule-actions-menu';
import { ScheduleSidePanel } from '@/components/service-schedules/schedule-side-panel';
import { createServiceSchedulesColumns } from '@/components/service-schedules/service-schedules-columns';
import { ServiceSchedulesAgendaToolbar } from '@/components/service-schedules/service-schedules-agenda-toolbar';
import { TripledEmptyState, TripledListLoadingState } from '@/components/tripled';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import type { ActionErrorType } from '@/lib/errors';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { formatScheduleShortDate } from '@/lib/schedule-agenda-format';
import {
  buildScheduleAgendaQuery,
  parseScheduleAgendaParams,
  SCHEDULE_AGENDA_PAGE_SIZE,
  type ScheduleAgendaParams,
} from '@/lib/schedule-agenda-params';
import { SCHEDULE_SNOOZE_DAY_OPTIONS, type ScheduleSnoozeInput } from '@/lib/schedule-snooze';
import {
  canCreateTicketFromSchedule,
  canReadServiceSchedules,
  canWriteServiceSchedules,
  needsSelectedCompanyForSchedules,
} from '@/lib/service-schedules-rbac';
import { cn } from '@/lib/utils';

type SnoozeDateTarget = { ids: number[]; schedule: ClientServiceScheduleListItem | null };
type PauseTarget = { ids: number[]; schedule: ClientServiceScheduleListItem | null };

const errorMessage = (
  result: { error?: string; errorType?: ActionErrorType },
  fallback: string,
) =>
  getErrorMessageByType(
    classifyClientError(null, undefined, result.errorType),
    result.error || fallback,
  );

/**
 * Service schedules as an agenda (ZIG-I30, canvas RecA + RecPanel), from md:
 * views with counts, relative dates, hover Crear ticket and WhatsApp, ⋮ on
 * every row, a selection bar for Posponer / Pausar / Eliminar, and a side
 * panel with the service history. Phones keep ServiceSchedulesList.
 */
export const ServiceSchedulesAgenda = () => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const companyName = selectedCompany?.name ?? null;
  const permissions = usePermissions();
  const canRead = canReadServiceSchedules(permissions.can);
  const canWrite = canWriteServiceSchedules(permissions.can);
  const canCreateTicket = canCreateTicketFromSchedule(permissions.can);
  const missingCompany = needsSelectedCompanyForSchedules(permissions.isSystem, companyId);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = React.useMemo(() => parseScheduleAgendaParams(searchParams), [searchParams]);

  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [data, setData] = React.useState<PaginatedClientServiceSchedulesData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [serviceOptions, setServiceOptions] = React.useState<Array<{ id: number; name: string }>>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [reloadKey, setReloadKey] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ClientServiceScheduleListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ClientServiceScheduleListItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [snoozeDateTarget, setSnoozeDateTarget] = React.useState<SnoozeDateTarget | null>(null);
  const [markDoneTarget, setMarkDoneTarget] = React.useState<ClientServiceScheduleListItem | null>(null);
  const [pauseTarget, setPauseTarget] = React.useState<PauseTarget | null>(null);

  const undoToast = useUndoToast();

  const navigate = React.useCallback(
    (next: Partial<ScheduleAgendaParams>) => {
      const query = buildScheduleAgendaQuery(new URLSearchParams(searchParams.toString()), next);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(searchValue.trim()), 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  // A new search starts on the first page.
  const previousSearch = React.useRef(debouncedSearch);
  React.useEffect(() => {
    if (previousSearch.current !== debouncedSearch) {
      previousSearch.current = debouncedSearch;
      if (params.page !== 1) navigate({ page: 1 });
    }
  }, [debouncedSearch, navigate, params.page]);

  const reload = React.useCallback(() => setReloadKey((key) => key + 1), []);

  React.useEffect(() => {
    if (!canRead || missingCompany) {
      setLoading(false);
      setData(null);
      setLoadError(missingCompany ? 'Selecciona una empresa para ver recordatorios.' : null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void listClientServiceSchedulesPaginated({
      companyId,
      view: params.view,
      search: debouncedSearch,
      serviceId: params.serviceId,
      sort: params.sort,
      page: params.page,
      pageSize: SCHEDULE_AGENDA_PAGE_SIZE,
    }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.success || !result.data) {
        setLoadError(errorMessage(result, 'No se pudieron cargar los recordatorios'));
        setData(null);
        return;
      }
      setLoadError(null);
      setData(result.data);
      setRowSelection({});
    });
    return () => {
      cancelled = true;
    };
  }, [
    canRead,
    companyId,
    debouncedSearch,
    missingCompany,
    params.page,
    params.serviceId,
    params.sort,
    params.view,
    reloadKey,
  ]);

  React.useEffect(() => {
    if (!canRead || missingCompany) return;
    void listClientServiceScheduleServiceOptions(companyId).then((result) => {
      if (result.success && result.data) setServiceOptions(result.data);
    });
  }, [canRead, companyId, missingCompany, reloadKey]);

  const restoreDates = React.useCallback(
    async (entries: ClientServiceScheduleDates[]) => {
      const result = await restoreClientServiceScheduleDates(entries, companyId);
      if (result.success) {
        toast.success('Listo, quedó como estaba');
        reload();
      } else {
        toast.error(errorMessage(result, 'No se pudo deshacer'));
      }
    },
    [companyId, reload],
  );

  const snoozeOne = React.useCallback(
    async (schedule: ClientServiceScheduleListItem, input: ScheduleSnoozeInput) => {
      setBusy(true);
      const result = await snoozeClientServiceSchedule(schedule.id, input, companyId);
      setBusy(false);
      if (!result.success || !result.data) {
        toast.error(errorMessage(result, 'No se pudo posponer'));
        return false;
      }
      const previous = {
        id: schedule.id,
        lastServiceAt: schedule.lastServiceAt,
        nextDueAt: result.data.previousNextDueAt,
      };
      undoToast(`Pospuesto al ${formatScheduleShortDate(result.data.nextDueAt)}`, () => {
        void restoreDates([previous]);
      });
      reload();
      return true;
    },
    [companyId, reload, restoreDates, undoToast],
  );

  const snoozeMany = React.useCallback(
    async (ids: number[], input: ScheduleSnoozeInput) => {
      setBusy(true);
      const result = await bulkClientServiceSchedules({
        ids,
        action: 'snooze',
        snooze: input,
        companyId,
      });
      setBusy(false);
      if (!result.success || !result.data) {
        toast.error(errorMessage(result, 'No se pudieron posponer'));
        return false;
      }
      const { appliedIds, previous } = result.data;
      const skipped = ids.length - appliedIds.length;
      const label =
        `${appliedIds.length === 1 ? '1 recordatorio pospuesto' : `${appliedIds.length} recordatorios pospuestos`}` +
        (skipped > 0 ? ` (${skipped} pausado${skipped === 1 ? '' : 's'} sin cambio)` : '');
      if (previous.length) {
        undoToast(label, () => {
          void restoreDates(previous);
        });
      } else {
        toast.success(label);
      }
      reload();
      return true;
    },
    [companyId, reload, restoreDates, undoToast],
  );

  const pauseMany = React.useCallback(
    async (target: PauseTarget, reason: string) => {
      setBusy(true);
      const result = target.schedule
        ? await pauseClientServiceSchedule(target.schedule.id, reason, companyId)
        : await bulkClientServiceSchedules({
            ids: target.ids,
            action: 'pause',
            pauseReason: reason,
            companyId,
          });
      setBusy(false);
      if (!result.success) {
        toast.error(errorMessage(result, 'No se pudo pausar'));
        return;
      }
      setPauseTarget(null);
      toast.success(
        target.ids.length > 1 ? `${target.ids.length} recordatorios pausados` : 'Recordatorio pausado',
      );
      reload();
    },
    [companyId, reload],
  );

  const handlers: ScheduleActionHandlers = React.useMemo(
    () => ({
      onSnoozeDays: (schedule, days) => void snoozeOne(schedule, { days }),
      onSnoozePickDate: (schedule) => setSnoozeDateTarget({ ids: [schedule.id], schedule }),
      onMarkDone: (schedule) => setMarkDoneTarget(schedule),
      onEdit: (schedule) => {
        setEditing(schedule);
        setFormOpen(true);
      },
      onPause: (schedule) => setPauseTarget({ ids: [schedule.id], schedule }),
      onResume: (schedule) => {
        void (async () => {
          setBusy(true);
          const result = await resumeClientServiceSchedule(schedule.id, companyId);
          setBusy(false);
          if (result.success) {
            toast.success('Recordatorio reanudado');
            reload();
          } else {
            toast.error(errorMessage(result, 'No se pudo reanudar'));
          }
        })();
      },
      onDelete: (schedule) => setDeleteTarget(schedule),
    }),
    [companyId, reload, snoozeOne],
  );

  const handleMarkDone = async (doneOn: string) => {
    if (!markDoneTarget) return;
    setBusy(true);
    const result = await markClientServiceScheduleDone(markDoneTarget.id, doneOn, companyId);
    setBusy(false);
    if (!result.success || !result.data) {
      toast.error(errorMessage(result, 'No se pudo marcar como hecho'));
      return;
    }
    const { previous, applied } = result.data;
    setMarkDoneTarget(null);
    undoToast(`Marcado como hecho. Próximo: ${formatScheduleShortDate(applied.nextDueAt)}`, () => {
      void restoreDates([previous]);
    });
    reload();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await deleteClientServiceSchedule(deleteTarget.id, companyId);
    setBusy(false);
    if (result.success) {
      if (params.openId === deleteTarget.id) navigate({ openId: null });
      setDeleteTarget(null);
      toast.success('Recordatorio eliminado');
      reload();
    } else {
      toast.error(errorMessage(result, 'No se pudo eliminar'));
    }
  };

  const items = React.useMemo(() => data?.items ?? [], [data]);
  const columns = React.useMemo(
    () =>
      createServiceSchedulesColumns({
        canWrite,
        canCreateTicket,
        companyName,
        onOpen: (schedule) => navigate({ openId: schedule.id }),
        ...handlers,
      }),
    [canCreateTicket, canWrite, companyName, handlers, navigate],
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { rowSelection },
    enableRowSelection: canWrite,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const selectedIds = Object.keys(rowSelection)
    .filter((id) => rowSelection[id])
    .map(Number);

  const handleConfirmBulkDelete = async () => {
    setBusy(true);
    const result = await bulkClientServiceSchedules({
      ids: selectedIds,
      action: 'delete',
      companyId,
    });
    setBusy(false);
    if (!result.success || !result.data) {
      toast.error(errorMessage(result, 'No se pudieron eliminar'));
      return;
    }
    setBulkDeleteOpen(false);
    if (params.openId && selectedIds.includes(params.openId)) navigate({ openId: null });
    toast.success(
      result.data.appliedIds.length === 1
        ? 'Recordatorio eliminado'
        : `${result.data.appliedIds.length} recordatorios eliminados`,
    );
    reload();
  };

  const hasActiveFilters = debouncedSearch !== '' || params.serviceId != null;
  const counts = data?.counts ?? null;
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (params.page - 1) * SCHEDULE_AGENDA_PAGE_SIZE + 1;
  const end = Math.min(total, params.page * SCHEDULE_AGENDA_PAGE_SIZE);
  const totalPages = data?.totalPages ?? 1;
  const clearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    navigate({ serviceId: null, page: 1 });
  };
  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="service-schedules-agenda">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Recordatorios de servicio
            {counts ? (
              <span className="font-normal text-muted-foreground">
                {' · '}
                <span className="tabular-nums">{counts.todos}</span>
              </span>
            ) : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            Servicios recurrentes por cliente. Al terminar el ticket, el recordatorio se reprograma
            solo.
          </p>
        </div>
        {canWrite ? (
          <Button type="button" className="min-h-11 gap-1.5 rounded-xl" onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden data-icon="inline-start" />
            Nuevo recordatorio
          </Button>
        ) : null}
      </div>

      <ServiceSchedulesAgendaToolbar
        view={params.view}
        onViewChange={(view) => navigate({ view, page: 1 })}
        counts={counts}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        serviceId={params.serviceId}
        onServiceChange={(serviceId) => navigate({ serviceId, page: 1 })}
        serviceOptions={serviceOptions}
        sort={params.sort}
        onSortChange={(sort) => navigate({ sort, page: 1 })}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {loading && !data ? (
        <TripledListLoadingState
          label="Cargando lista de recordatorios"
          desktopColumns={6}
          desktopRows={6}
        />
      ) : loadError ? (
        <TripledEmptyState
          icon={<CalendarClock className="h-4 w-4" />}
          title="Error al cargar"
          description={loadError}
          role="alert"
          action={
            <Button type="button" variant="outline" className="rounded-xl" onClick={reload}>
              Reintentar
            </Button>
          }
        />
      ) : counts && counts.todos === 0 && !hasActiveFilters ? (
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
              <Button type="button" className="rounded-xl" onClick={openNew}>
                <Plus className="h-4 w-4" aria-hidden data-icon="inline-start" />
                Nuevo recordatorio
              </Button>
            ) : null
          }
        />
      ) : items.length === 0 ? (
        <TripledEmptyState
          icon={<CalendarClock className="h-4 w-4" />}
          title={hasActiveFilters ? 'Sin resultados' : 'Nada en esta vista'}
          description={
            hasActiveFilters
              ? 'No hay recordatorios que coincidan con la búsqueda o el servicio.'
              : params.view === 'por-atender'
                ? 'No hay recordatorios atrasados ni para las próximas dos semanas.'
                : 'No hay recordatorios en esta vista.'
          }
          action={
            hasActiveFilters ? (
              <Button type="button" variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : null
          }
        />
      ) : (
        <div className={cn('flex flex-col', loading && 'opacity-60 transition-opacity')}>
          <table
            className="w-full table-fixed caption-bottom border-collapse text-sm [&_td]:h-14 [&_td]:px-3 [&_td]:py-0 [&_td]:align-middle [&_th]:h-10 [&_th]:bg-background [&_th]:px-3 [&_th]:py-2 [&_th]:align-middle [&_tr]:border-border/60"
            data-testid="service-schedules-table"
          >
            <TableHeader className="sticky top-16 z-20 bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className={header.column.columnDef.meta?.className}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  data-testid="service-schedule-row"
                  data-schedule-id={row.original.id}
                  className={cn(
                    'group cursor-pointer',
                    params.openId === row.original.id && 'bg-muted/50',
                  )}
                  onClick={() => navigate({ openId: row.original.id })}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 px-1 py-3">
            <p className="text-sm tabular-nums text-muted-foreground" data-testid="service-schedules-range">
              {`${start}–${end} de ${total}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11"
                onClick={() => navigate({ page: params.page - 1 })}
                disabled={params.page <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11"
                onClick={() => navigate({ page: params.page + 1 })}
                disabled={params.page >= totalPages}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedIds.length > 0 ? (
        <div
          role="toolbar"
          aria-label="Acciones de la selección"
          data-testid="service-schedules-selection-bar"
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-foreground px-3 py-2 text-background shadow-xl"
        >
          <span className="px-2 text-sm font-medium tabular-nums">
            {selectedIds.length === 1 ? '1 seleccionado' : `${selectedIds.length} seleccionados`}
          </span>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-9 gap-1 text-background hover:bg-background/15 hover:text-background"
                disabled={busy}
              >
                Posponer
                <ChevronDown className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top">
              {SCHEDULE_SNOOZE_DAY_OPTIONS.map((days) => (
                <DropdownMenuItem key={days} onSelect={() => void snoozeMany(selectedIds, { days })}>
                  {days} días
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setSnoozeDateTarget({ ids: selectedIds, schedule: null })}
              >
                Elegir fecha…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="ghost"
            className="h-9 text-background hover:bg-background/15 hover:text-background"
            disabled={busy}
            onClick={() => setPauseTarget({ ids: selectedIds, schedule: null })}
          >
            Pausar
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-9 text-red-300 hover:bg-background/15 hover:text-red-200"
            disabled={busy}
            onClick={() => setBulkDeleteOpen(true)}
          >
            Eliminar
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-9 text-background/80 hover:bg-background/15 hover:text-background"
            onClick={() => setRowSelection({})}
          >
            Cancelar
          </Button>
        </div>
      ) : null}

      <ScheduleSidePanel
        scheduleId={params.openId}
        onClose={() => navigate({ openId: null })}
        companyId={companyId}
        companyName={companyName}
        canWrite={canWrite}
        canCreateTicket={canCreateTicket}
        refreshKey={reloadKey}
        {...handlers}
      />

      <ScheduleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        schedule={editing}
        onSaved={reload}
      />

      <ScheduleSnoozeDateDialog
        open={snoozeDateTarget != null}
        onOpenChange={(open) => !open && setSnoozeDateTarget(null)}
        busy={busy}
        count={snoozeDateTarget?.ids.length ?? 1}
        onConfirm={(until) => {
          const target = snoozeDateTarget;
          if (!target) return;
          void (target.schedule
            ? snoozeOne(target.schedule, { until })
            : snoozeMany(target.ids, { until })
          ).then((ok) => {
            if (ok) setSnoozeDateTarget(null);
          });
        }}
      />

      <ScheduleMarkDoneDialog
        open={markDoneTarget != null}
        onOpenChange={(open) => !open && setMarkDoneTarget(null)}
        busy={busy}
        schedule={markDoneTarget}
        onConfirm={(doneOn) => void handleMarkDone(doneOn)}
      />

      <SchedulePauseDialog
        open={pauseTarget != null}
        onOpenChange={(open) => !open && setPauseTarget(null)}
        busy={busy}
        count={pauseTarget?.ids.length ?? 1}
        onConfirm={(reason) => pauseTarget && void pauseMany(pauseTarget, reason)}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar recordatorio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El recordatorio dejará de mostrarse en las listas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void handleConfirmDelete()}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedIds.length === 1
                ? '¿Eliminar 1 recordatorio?'
                : `¿Eliminar ${selectedIds.length} recordatorios?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Dejarán de mostrarse en las listas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void handleConfirmBulkDelete()}>
              {selectedIds.length === 1 ? 'Eliminar' : `Eliminar ${selectedIds.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
