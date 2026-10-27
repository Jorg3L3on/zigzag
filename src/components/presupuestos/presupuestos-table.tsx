'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { endOfDay, startOfDay } from 'date-fns';
import { Plus } from 'lucide-react';
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
  LIST_PAGE_SIZE,
  ListColumnsMenu,
  ListDesktopTitle,
  ListEmpty,
  ListError,
  ListFooter,
  ListLoading,
  ListNoResults,
  ListShortDate,
  ListSortableHeader,
  ListStatusPill,
  ListTable,
  ListTableCard,
  ListToolbar,
  ListViewTabs,
  listFooterPagination,
  useListHiddenColumns,
  type ListColumnOption,
  type ListStatusTone,
  type ListViewTab,
} from '@/components/list-page';
import {
  PresupuestoConfirmSheet,
  type PresupuestoConfirmKind,
} from '@/components/presupuestos/presupuesto-confirm-sheet';
import { PresupuestoExtendDialog } from '@/components/presupuestos/presupuesto-extend-dialog';
import { PresupuestoRowMenu } from '@/components/presupuestos/presupuesto-row-actions';
import {
  parsePresupuestoSortParam,
  presupuestoSortForServer,
  presupuestoSortParam,
} from '@/components/presupuestos/presupuestos-sort';
import { usePresupuestoDuplicate } from '@/components/presupuestos/use-presupuesto-duplicate';
import { TicketDateRangeFilter } from '@/components/tickets/tickets-filter-fields';
import { Button } from '@/components/ui/button';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { formatPhoneDisplay } from '@/lib/phone-links';
import { describePresupuestoVenceCell } from '@/lib/presupuesto-vigencia';
import {
  parsePresupuestoView,
  type PresupuestoListCounts,
  type PresupuestoListView,
} from '@/lib/presupuestos-list-views';
import type { PresupuestoStatus } from '@/lib/ticket-document-kind';
import { cn } from '@/lib/utils';

const OPTIONAL_COLUMNS: ListColumnOption[] = [
  { id: 'trabajo', label: 'Trabajo' },
  { id: 'emitido', label: 'Emitido' },
  { id: 'vence', label: 'Vence' },
  { id: 'total', label: 'Total' },
];

/** Aceptado is green on desktop only, the good outcome (6f15aba8); the phone keeps grey. */
const STATUS_TONE: Record<PresupuestoStatus, ListStatusTone> = {
  abierto: 'blue',
  vencido: 'red',
  convertido: 'emerald',
  cancelado: 'slate',
};

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

type PresupuestosTableProps = {
  companyId: number | null;
  companyName: string | null;
  canWrite: boolean;
  canInvoice: boolean;
  /** False below lg, where the phone cards load instead. */
  enabled: boolean;
};

/**
 * Presupuestos from lg (ZIG-I29-3, ListaPresuA; ZIG-I33-2 standard): view tabs with
 * server counts (default Abiertos + Vencidos), search and issue dates, then the table
 * Folio · Cliente · Trabajo · Emitido · Vence · Total · Estado · ⋯ in its card with
 * the footer. The headers sort on the server; every row action is in ⋯. No amounts
 * in the views (f18a2f7d).
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
  // `?orden=` from the header (or an old link's `vence` / `recientes` / `total`).
  const ordenParam = searchParams.get('orden');
  const sorting = React.useMemo(() => parsePresupuestoSortParam(ordenParam), [ordenParam]);
  const sortKey = presupuestoSortParam(sorting) ?? 'default';

  const [items, setItems] = React.useState<PresupuestoTableItem[]>([]);
  const [counts, setCounts] = React.useState<PresupuestoListCounts | null>(null);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [loadedOnce, setLoadedOnce] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: LIST_PAGE_SIZE,
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
  }, [debouncedSearch, dateRange, sortKey, view]);

  const load = React.useCallback(async () => {
    if (!enabled) return;
    if (!companyId) {
      setLoading(false);
      setLoadedOnce(true);
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
        sort: presupuestoSortForServer(sorting),
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
      setLoadedOnce(true);
    }
  }, [
    enabled,
    companyId,
    view,
    debouncedSearch,
    dateRange,
    sorting,
    pagination.pageIndex,
    pagination.pageSize,
  ]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const setParam = (name: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value == null) {
      params.delete(name);
    } else {
      params.set(name, value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // Clicking the view you are on goes back to the default Abiertos + Vencidos.
  const selectView = (next: TabId) => setParam('estado', next === view ? null : next);

  const handleSortingChange = (updater: Updater<SortingState>) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    setParam('orden', presupuestoSortParam(next));
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
        accessorFn: (row) => Number(row.id),
        sortDescFirst: true,
        header: ({ column }) => <ListSortableHeader column={column} label="Folio" />,
        meta: { className: 'w-[6rem]' },
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium tabular-nums">{row.original.folio}</span>
        ),
      },
      {
        id: 'cliente',
        accessorFn: (row) => row.clientName ?? '',
        sortDescFirst: false,
        header: ({ column }) => <ListSortableHeader column={column} label="Cliente" />,
        // Takes what is left (about 200px at 1024 with the sidebar open) until Trabajo shows; then
        // 21rem, as wide as at 1280: client names win over Trabajo, as on the tickets list.
        meta: { className: '@min-[75rem]:w-[21rem]' },
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
        // Only once Cliente keeps 21rem and Trabajo gets the canvas's 220px (75rem list, ~1504 with the sidebar).
        meta: { className: 'hidden @min-[75rem]:table-cell' },
        cell: ({ row }) => {
          const { servicesSummary, servicesHead, servicesCount } = row.original;
          if (!servicesSummary) {
            return <span className="text-sm text-muted-foreground">Sin conceptos todavía</span>;
          }
          // «A, B… +2»: the first two conceptos, then how many more (canvas).
          const more = Math.max((servicesCount ?? 0) - 2, 0);
          return (
            <span
              className="flex min-w-0 items-baseline gap-1 text-slate-600 md:text-[13px] dark:text-slate-300"
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
        accessorFn: (row) => row.ticketDate,
        sortDescFirst: true,
        header: ({ column }) => <ListSortableHeader column={column} label="Emitido" />,
        meta: { className: 'hidden w-[5.5rem] @min-[48rem]:table-cell' },
        cell: ({ row }) => <ListShortDate date={row.original.ticketDate} />,
      },
      {
        id: 'vence',
        accessorFn: (row) => row.expiresAt,
        sortDescFirst: false,
        header: ({ column }) => <ListSortableHeader column={column} label="Vence" />,
        // «25 oct · vigencia de 15 días» needs the room (canvas column 150px).
        meta: { className: 'w-[10rem]' },
        cell: ({ row }) => {
          const cell = describePresupuestoVenceCell({
            expiresAt: row.original.expiresAt,
            status: row.original.status,
            ticketDate: row.original.ticketDate,
          });
          return (
            <span className="flex flex-col leading-snug md:text-[13px]" data-testid="presupuesto-vence" data-tone={cell.tone}>
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
        accessorFn: (row) => row.total,
        sortDescFirst: true,
        header: ({ column }) => <ListSortableHeader column={column} label="Total" align="right" />,
        meta: { className: 'w-[8.5rem]', align: 'right' },
        cell: ({ row }) => (
          <span className="font-semibold">
            <FormattedCurrency amount={row.original.total ?? 0} />
          </span>
        ),
      },
      {
        id: 'estado',
        header: 'Estado',
        meta: { className: 'w-[6.75rem]' },
        cell: ({ row }) => (
          <ListStatusPill tone={STATUS_TONE[row.original.status]}>
            <span data-testid="presupuesto-status">{row.original.statusLabel}</span>
          </ListStatusPill>
        ),
      },
      {
        id: 'acciones',
        enableHiding: false,
        header: () => <span className="sr-only">Acciones</span>,
        meta: { className: 'w-12' },
        cell: ({ row }) => (
          <div className="flex justify-end">
            <PresupuestoRowMenu
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
    state: { sorting, pagination, columnVisibility: hiddenColumns.visibility },
    onSortingChange: handleSortingChange,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    // The rows come sorted and paged from the server.
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
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
  // Limpiar shows as soon as something is typed, before the search debounces.
  const hasActiveFilters = searchValue.trim().length > 0 || Boolean(dateRange?.from);
  const clearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setDateRange(undefined);
  };

  let body: React.ReactNode;
  if (error) {
    body = <ListError description={error} onRetry={() => void load()} />;
  } else if (loading && !loadedOnce) {
    body = <ListLoading label="Cargando presupuestos…" columns={7} />;
  } else if (items.length === 0) {
    if (counts && counts.all === 0 && !hasFilters) {
      body = (
        <ListEmpty
          title="Sin presupuestos"
          description="Crea un presupuesto para cotizar trabajo antes de abrirlo como ticket."
          action={
            canWrite ? (
              <Button asChild>
                <Link href="/presupuestos/create">Nuevo presupuesto</Link>
              </Button>
            ) : undefined
          }
        />
      );
    } else if (hasFilters) {
      body = (
        <ListNoResults
          description="Ningún presupuesto coincide con la búsqueda o las fechas."
          onClear={clearFilters}
        />
      );
    } else {
      body = (
        <ListEmpty
          title="Nada en esta vista"
          description="Elige otra vista arriba para ver más presupuestos."
        />
      );
    }
  } else {
    body = (
      // Columns follow the page width, not the viewport: the sidebar takes 256px (ZIG-I29).
      <ListTableCard
        className="@container"
        footer={
          <ListFooter
            total={totalCount}
            noun="presupuestos"
            shown={items.length}
            pagination={listFooterPagination(table)}
          />
        }
      >
        <ListTable
          table={table}
          ariaLabel="Presupuestos"
          busy={loading}
          getRowHref={(row) => `/presupuestos/${row.original.id}`}
          rowTestId="presupuesto-table-row"
        />
      </ListTableCard>
    );
  }

  return (
    <div data-testid="presupuestos-table-view">
      <ListDesktopTitle
        title="Presupuestos"
        count={counts?.all ?? null}
        description="No cuentan en Cobranza ni en Hoy hasta convertirlos en ticket."
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/presupuestos/create">
                <Plus className="h-4 w-4 shrink-0" aria-hidden data-icon="inline-start" />
                Nuevo presupuesto
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <ListViewTabs
            label="Vistas de presupuestos"
            tabs={tabs}
            isSelected={isSelected}
            onSelect={selectView}
          />
          <ListToolbar
            search={{
              value: searchValue,
              onChange: setSearchValue,
              placeholder: 'Buscar por cliente, folio o teléfono',
              ariaLabel: 'Buscar presupuestos por cliente, folio o teléfono',
            }}
            filters={
              <TicketDateRangeFilter
                layout="desktop"
                value={dateRange}
                onChange={setDateRange}
                ariaLabel="Filtrar por fecha de emisión"
              />
            }
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            trailing={
              <ListColumnsMenu table={table} options={OPTIONAL_COLUMNS} onToggle={hiddenColumns.toggle} />
            }
          />
        </div>

        {body}
      </div>

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
