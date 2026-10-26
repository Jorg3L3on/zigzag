'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from '@tanstack/react-table';
import { endOfDay, format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Plus, Search } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';

import {
  cancelPresupuesto,
  convertPresupuestoToTicket,
  getPresupuestosPaginated,
  type PresupuestoTableItem,
} from '@/actions/presupuestos';
import { FormattedCurrency } from '@/components/formatted-currency';
import {
  ListColumnsMenu,
  useListHiddenColumns,
  type ListColumnOption,
} from '@/components/list-views/list-columns-menu';
import { ListViewTabs, type ListViewTab } from '@/components/list-views/list-view-tabs';
import {
  PresupuestoConfirmSheet,
  type PresupuestoConfirmKind,
} from '@/components/presupuestos/presupuesto-confirm-sheet';
import { PresupuestoExtendDialog } from '@/components/presupuestos/presupuesto-extend-dialog';
import { PresupuestoRowActions } from '@/components/presupuestos/presupuesto-row-actions';
import { PresupuestoStatusPill } from '@/components/presupuestos/presupuesto-status-pill';
import { usePresupuestoDuplicate } from '@/components/presupuestos/use-presupuesto-duplicate';
import { TicketDateRangeFilter } from '@/components/tickets/tickets-filter-fields';
import { TicketsListPagination } from '@/components/tickets/tickets-list-pagination';
import { TripledEmptyState, TripledListLoadingState } from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { formatPhoneDisplay } from '@/lib/phone-links';
import { describePresupuestoVenceCell } from '@/lib/presupuesto-vigencia';
import {
  parsePresupuestoView,
  PRESUPUESTO_SORT_LABEL,
  type PresupuestoListCounts,
  type PresupuestoListSort,
  type PresupuestoListView,
} from '@/lib/presupuestos-list-views';
import { cn } from '@/lib/utils';

const DEFAULT_PAGE_SIZE = 25;

/** The footer line of a single page (canvas ListaPresuA). */
const SORT_NOTE: Record<PresupuestoListSort, string> = {
  vence: 'Orden: vencen primero, luego los más recientes',
  recientes: 'Orden: los más recientes primero',
  total: 'Orden: el mayor total primero',
};

const OPTIONAL_COLUMNS: ListColumnOption[] = [
  { id: 'trabajo', label: 'Trabajo' },
  { id: 'emitido', label: 'Emitido' },
  { id: 'vence', label: 'Vence' },
  { id: 'total', label: 'Total' },
];

const VENCE_TONE_CLASS = {
  expired: 'text-red-700 dark:text-red-300',
  soon: 'text-amber-700 dark:text-amber-300',
  ok: 'text-foreground',
  none: 'text-muted-foreground',
} as const;

type TabId = Exclude<PresupuestoListView, 'pendientes'>;

const TABS: Array<{
  id: TabId;
  label: string;
  countKey: keyof PresupuestoListCounts;
  dot: string | null;
}> = [
  { id: 'todos', label: 'Todos', countKey: 'all', dot: null },
  { id: 'abiertos', label: 'Abiertos', countKey: 'abierto', dot: 'bg-blue-500' },
  { id: 'vencidos', label: 'Vencidos', countKey: 'vencido', dot: 'bg-red-500' },
  { id: 'aceptados', label: 'Aceptados', countKey: 'convertido', dot: 'bg-emerald-500' },
  { id: 'cancelados', label: 'Cancelados', countKey: 'cancelado', dot: 'bg-slate-500' },
];

const shortDate = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, date.getFullYear() === new Date().getFullYear() ? 'd MMM' : 'd MMM yyyy', {
    locale: es,
  });
};

type PresupuestosTableProps = {
  companyId: number | null;
  companyName: string | null;
  canWrite: boolean;
  canInvoice: boolean;
  /** False below md, where the phone cards load instead. */
  enabled: boolean;
};

/**
 * Presupuestos from md (ZIG-I29-3, ListaPresuA): view tabs with server counts
 * (default Abiertos + Vencidos), search, issue dates and order, then the table
 * Folio · Cliente · Trabajo · Emitido · Vence · Total · Estado with hover
 * actions and ⋮. No amounts in the views (f18a2f7d).
 */
export const PresupuestosTable = ({
  companyId,
  companyName,
  canWrite,
  canInvoice,
  enabled,
}: PresupuestosTableProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = parsePresupuestoView(searchParams.get('estado'));

  const [items, setItems] = React.useState<PresupuestoTableItem[]>([]);
  const [counts, setCounts] = React.useState<PresupuestoListCounts | null>(null);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [sort, setSort] = React.useState<PresupuestoListSort>('vence');
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [confirm, setConfirm] = React.useState<{
    kind: PresupuestoConfirmKind;
    item: PresupuestoTableItem;
  } | null>(null);
  const [extending, setExtending] = React.useState<PresupuestoTableItem | null>(null);
  const [mutating, setMutating] = React.useState(false);
  const { duplicating, duplicate } = usePresupuestoDuplicate(companyId);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(searchValue.trim()), 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, dateRange, sort, view]);

  const load = React.useCallback(async () => {
    if (!enabled) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getPresupuestosPaginated({
        companyId,
        view,
        search: debouncedSearch || undefined,
        dateFrom: dateRange?.from ? startOfDay(dateRange.from).toISOString() : undefined,
        dateTo: dateRange?.from
          ? endOfDay(dateRange.to ?? dateRange.from).toISOString()
          : undefined,
        sort,
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
      });
      if (!result.success || !result.data) {
        setError(getErrorDisplayMessage(result, 'No se pudieron cargar los presupuestos'));
        return;
      }
      setItems(result.data.items);
      setCounts(result.data.counts);
      setTotalCount(result.data.total);
    } catch {
      setError('No se pudieron cargar los presupuestos');
    } finally {
      setLoading(false);
    }
  }, [
    enabled,
    companyId,
    view,
    debouncedSearch,
    dateRange,
    sort,
    pagination.pageIndex,
    pagination.pageSize,
  ]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selectView = (next: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    // Clicking the view you are on goes back to the default Abiertos + Vencidos.
    if (next === view) {
      params.delete('estado');
    } else {
      params.set('estado', next);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleConfirm = async (kind: PresupuestoConfirmKind) => {
    if (!confirm) return;
    setMutating(true);
    try {
      if (kind === 'convert') {
        const result = await convertPresupuestoToTicket(Number(confirm.item.id), companyId);
        if (!result.success || !result.data) {
          toast.error(getErrorDisplayMessage(result, 'No se pudo convertir el presupuesto'));
          return;
        }
        toast.success(
          `Presupuesto aceptado: ticket ${result.data.ticketFolio ?? `#${result.data.ticketId}`}`,
        );
        router.push(`/tickets/${result.data.ticketId}`);
        return;
      }
      const result = await cancelPresupuesto(Number(confirm.item.id), companyId);
      if (!result.success) {
        toast.error(getErrorDisplayMessage(result, 'No se pudo cancelar el presupuesto'));
        return;
      }
      toast.success('Presupuesto cancelado');
      void load();
    } finally {
      setMutating(false);
      setConfirm(null);
    }
  };

  const busy = mutating || duplicating;

  const columns = React.useMemo<ColumnDef<PresupuestoTableItem>[]>(
    () => [
      {
        id: 'folio',
        header: 'Folio',
        meta: { className: 'w-[6rem]' },
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium tabular-nums">{row.original.folio}</span>
        ),
      },
      {
        id: 'cliente',
        header: 'Cliente',
        // Takes what is left: about 200px at 1024 with the sidebar open.
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium" title={row.original.clientName ?? undefined}>
              {row.original.clientName ?? 'Sin cliente'}
            </span>
            {row.original.clientTel ? (
              <span className="truncate text-caption tabular-nums text-muted-foreground">
                {formatPhoneDisplay(row.original.clientTel) ?? row.original.clientTel}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'trabajo',
        header: 'Trabajo',
        meta: { className: 'hidden @min-[52rem]:table-cell' },
        cell: ({ row }) => {
          const { servicesSummary, servicesHead, servicesCount } = row.original;
          if (!servicesSummary) {
            return <span className="text-sm text-muted-foreground">Sin conceptos todavía</span>;
          }
          // «A, B… +2»: the first two conceptos, then how many more (canvas).
          const more = Math.max((servicesCount ?? 0) - 2, 0);
          return (
            <span
              className="flex min-w-0 items-baseline gap-1 text-[13px] text-slate-600 dark:text-slate-300"
              title={servicesSummary}
            >
              <span className="truncate">{servicesHead?.length ? servicesHead.join(', ') : servicesSummary}</span>
              {more > 0 ? <span className="shrink-0 text-muted-foreground/70">+{more}</span> : null}
            </span>
          );
        },
      },
      {
        id: 'emitido',
        header: 'Emitido',
        meta: { className: 'hidden w-[5.5rem] @min-[48rem]:table-cell' },
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{shortDate(row.original.ticketDate)}</span>
        ),
      },
      {
        id: 'vence',
        header: 'Vence',
        // «25 oct · vigencia de 15 días» needs the room (canvas column 150px).
        meta: { className: 'w-[10rem]' },
        cell: ({ row }) => {
          const cell = describePresupuestoVenceCell({
            expiresAt: row.original.expiresAt,
            status: row.original.status,
            ticketDate: row.original.ticketDate,
          });
          return (
            <span className="flex flex-col text-[13px] leading-snug" data-testid="presupuesto-vence" data-tone={cell.tone}>
              <span
                className={cn(
                  'tabular-nums',
                  cell.sub ? cn('font-medium', VENCE_TONE_CLASS[cell.tone]) : 'text-muted-foreground',
                )}
              >
                {cell.text}
              </span>
              {cell.sub ? <span className="text-caption text-muted-foreground">{cell.sub}</span> : null}
            </span>
          );
        },
      },
      {
        id: 'total',
        header: () => <span className="block text-right">Total</span>,
        meta: { className: 'w-[8.5rem] text-right' },
        cell: ({ row }) => (
          <span className="block text-right font-semibold tabular-nums">
            <FormattedCurrency amount={row.original.total ?? 0} />
          </span>
        ),
      },
      {
        id: 'estado',
        header: 'Estado',
        meta: { className: 'w-[6.75rem]' },
        cell: ({ row }) => <PresupuestoStatusPill status={row.original.status} surface="desktop" />,
      },
      {
        id: 'acciones',
        header: () => <span className="sr-only">Acciones</span>,
        // Only ⋮ takes room; the hover actions float over the row.
        meta: { className: 'w-[3.25rem]' },
        cell: ({ row }) => (
          <div
            className="flex justify-end"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <PresupuestoRowActions
              item={row.original}
              canWrite={canWrite}
              canInvoice={canInvoice}
              companyId={companyId}
              companyName={companyName}
              busy={busy}
              onConvert={(item) => setConfirm({ kind: 'convert', item })}
              onCancel={(item) => setConfirm({ kind: 'cancel', item })}
              onExtend={setExtending}
              onDuplicate={(item) => void duplicate(item.id)}
            />
          </div>
        ),
      },
    ],
    [busy, canInvoice, canWrite, companyId, companyName, duplicate],
  );

  const hiddenColumns = useListHiddenColumns('zigzag:presupuestos-columns:v1');
  const table = useReactTable({
    data: items,
    columns,
    state: { pagination, columnVisibility: hiddenColumns.visibility },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(totalCount / pagination.pageSize)),
  });

  // Canvas ListaPresuA: «6 presupuestos» under Todos, «4 · 1 vence hoy» under Abiertos.
  const tabs: ListViewTab<TabId>[] = TABS.map((tab) => {
    const count = counts ? counts[tab.countKey] : null;
    let caption: string | null = count == null ? null : String(count);
    if (count != null && tab.id === 'todos') {
      caption = `${count} ${count === 1 ? 'presupuesto' : 'presupuestos'}`;
    } else if (count != null && tab.id === 'abiertos' && counts && counts.venceHoy > 0) {
      caption = `${count} · ${counts.venceHoy} ${counts.venceHoy === 1 ? 'vence' : 'vencen'} hoy`;
    }
    return { id: tab.id, label: tab.label, count, dot: tab.dot, caption };
  });
  const isSelected = (id: TabId) =>
    view === id || (view === 'pendientes' && (id === 'abiertos' || id === 'vencidos'));
  const hasFilters = debouncedSearch.length > 0 || Boolean(dateRange?.from);
  const clearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setDateRange(undefined);
  };

  return (
    <div className="space-y-4" data-testid="presupuestos-table-view">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Presupuestos
            {counts ? <span className="font-normal text-muted-foreground"> · {counts.all}</span> : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            No cuentan en Cobranza ni en Hoy hasta convertirlos en ticket.
          </p>
        </div>
        {canWrite ? (
          <Button asChild>
            <Link href="/presupuestos/create">
              <Plus className="h-4 w-4 shrink-0" aria-hidden data-icon="inline-start" />
              Nuevo presupuesto
            </Link>
          </Button>
        ) : null}
      </div>

      <ListViewTabs
        label="Vistas de presupuestos"
        tabs={tabs}
        isSelected={isSelected}
        onSelect={selectView}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[12rem] max-w-[360px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="h-11 rounded-xl bg-background pl-9 shadow-none"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Buscar por cliente, folio o teléfono"
            aria-label="Buscar presupuestos por cliente, folio o teléfono"
          />
        </div>
        <TicketDateRangeFilter
          layout="desktop"
          value={dateRange}
          onChange={setDateRange}
          ariaLabel="Filtrar por fecha de emisión"
        />
        {/* The order sits at the right end of the bar, as on the canvas. */}
        <div className="ml-auto flex items-center gap-2">
          <Select value={sort} onValueChange={(value) => setSort(value as PresupuestoListSort)}>
            <SelectTrigger className="h-11 w-48 rounded-full px-4" aria-label="Ordenar presupuestos">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRESUPUESTO_SORT_LABEL) as PresupuestoListSort[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {PRESUPUESTO_SORT_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ListColumnsMenu table={table} options={OPTIONAL_COLUMNS} onToggle={hiddenColumns.toggle} />
        </div>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            onClick={clearFilters}
          >
            Limpiar filtros
          </Button>
        ) : null}
      </div>

      {error ? (
        <TripledEmptyState
          icon={<FileText className="h-4 w-4" />}
          title="Error al cargar"
          description={error}
          role="alert"
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Reintentar
            </Button>
          }
        />
      ) : loading && items.length === 0 ? (
        <TripledListLoadingState label="Cargando presupuestos…" desktopColumns={7} desktopRows={6} />
      ) : items.length === 0 ? (
        counts && counts.all === 0 && !hasFilters ? (
          <TripledEmptyState
            icon={<FileText className="h-4 w-4" />}
            title="Sin presupuestos"
            description="Crea un presupuesto para cotizar trabajo antes de abrirlo como ticket."
            action={
              canWrite ? (
                <Button asChild>
                  <Link href="/presupuestos/create">Nuevo presupuesto</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <TripledEmptyState
            icon={<Search className="h-4 w-4" />}
            title="Nada en esta vista"
            description={
              hasFilters
                ? 'Ningún presupuesto coincide con la búsqueda o las fechas.'
                : 'Elige otra vista arriba para ver más presupuestos.'
            }
            action={
              hasFilters ? (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              ) : null
            }
          />
        )
      ) : (
        // Columns follow the page width, not the viewport: the sidebar takes 256px (ZIG-I29).
        <div className="@container">
          <table
            aria-label="Presupuestos"
            aria-busy={loading}
            className="w-full table-fixed caption-bottom border-collapse text-sm [&_td]:h-14 [&_td]:px-3 [&_td]:py-0 [&_td]:align-middle [&_th]:h-10 [&_th]:bg-background [&_th]:px-3 [&_th]:py-2 [&_th]:align-middle [&_tr]:border-border/60"
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
              {table.getRowModel().rows.map((row) => {
                const href = `/presupuestos/${row.original.id}`;
                return (
                  <TableRow
                    key={row.id}
                    className="group h-14 cursor-pointer"
                    tabIndex={0}
                    data-testid="presupuesto-table-row"
                    aria-label={`Presupuesto ${row.original.folio} · ${row.original.clientName ?? 'Sin cliente'} · ${row.original.statusLabel}`}
                    onClick={() => router.push(href)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(href);
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </table>
          <TicketsListPagination
            table={table}
            variant="desktop"
            totalCount={totalCount}
            noun="presupuestos"
            note={SORT_NOTE[sort]}
          />
        </div>
      )}

      <PresupuestoConfirmSheet
        kind={confirm?.kind ?? null}
        docLabel={confirm?.item.folio ?? ''}
        pending={mutating}
        onClose={() => setConfirm(null)}
        onConfirm={(kind) => void handleConfirm(kind)}
      />
      {extending ? (
        <PresupuestoExtendDialog
          open
          onOpenChange={(open) => {
            if (!open) setExtending(null);
          }}
          presupuestoId={extending.id}
          folio={extending.folio}
          ticketDate={extending.ticketDate}
          expiresAt={extending.expiresAt}
          companyId={companyId}
          onExtended={() => void load()}
        />
      ) : null}
    </div>
  );
};
