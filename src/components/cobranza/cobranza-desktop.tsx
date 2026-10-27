'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  getCoreRowModel,
  useReactTable,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { Banknote } from 'lucide-react';
import {
  getCobranzaPaginated,
  type CobranzaGroupBy,
  type CobranzaPaginatedData,
} from '@/actions/cobranza';
import { CobranzaAgingStrip } from '@/components/cobranza/cobranza-aging-strip';
import { CobranzaClientTable } from '@/components/cobranza/cobranza-client-table';
import {
  COBRANZA_SORT_COLUMN,
  createCobranzaColumns,
} from '@/components/cobranza/cobranza-columns';
import { CobranzaTicketTable } from '@/components/cobranza/cobranza-ticket-table';
import { FormattedCurrency } from '@/components/formatted-currency';
import {
  ListDesktopTitle,
  ListEmpty,
  ListError,
  ListFilterSelect,
  ListFooter,
  ListLoading,
  ListNoResults,
  ListTableCard,
  ListToolbar,
  type ListFooterPagination,
} from '@/components/list-page';
import { TicketListCollectPaymentDialog } from '@/components/tickets/ticket-list-collect-payment-dialog';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/contexts/company-context';
import {
  COBRANZA_SORT_FIRST_DIRECTION,
  isCobranzaSort,
  isCobranzaStatusFilter,
  type CobranzaAgingBucket,
  type CobranzaRow,
  type CobranzaSort,
  type CobranzaSortDirection,
  type CobranzaStatusFilter,
} from '@/lib/cobranza';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { cn } from '@/lib/utils';

const TABLE_ID = 'cobranza-desktop-table';
const PAGE_SIZE = 25;
/** ZIG-I33 §2: the search waits 300 ms and never reaches the URL. */
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS: Array<{ value: CobranzaStatusFilter; label: string }> = [
  { value: 'all', label: 'Pendientes y parciales' },
  { value: 'pending', label: 'Solo pendientes' },
  { value: 'partial', label: 'Solo parciales' },
];

const VIEW_COPY: Record<CobranzaGroupBy, { subtitle: string; placeholder: string }> = {
  ticket: {
    subtitle:
      'Saldos de tickets terminados: quién te debe, cuánto y desde cuándo. Lo que sigue en proceso se cobra al terminar.',
    placeholder: 'Buscar por cliente, folio o teléfono',
  },
  client: {
    subtitle: 'Un renglón por cliente con todo lo que debe; un solo WhatsApp con su estado de cuenta.',
    placeholder: 'Buscar por cliente o teléfono',
  },
};

/** `?tramo=`; a typed `90+` reaches us as `90 ` because `+` decodes to a space. */
export const parseCobranzaTramo = (value: string | null): CobranzaAgingBucket => {
  const raw = value?.trim();
  if (raw === '0-30' || raw === '31-90') return raw;
  if (raw === '90+' || raw === '90') return '90+';
  return 'all';
};

const tramoParam = (bucket: CobranzaAgingBucket): string | null =>
  bucket === 'all' ? null : bucket;

/** The server order behind the table headers, and its direction. */
export type CobranzaOrder = { sort: CobranzaSort; direction: CobranzaSortDirection };

/** Each view's default order, which the URL leaves out. */
const DEFAULT_SORT: Record<CobranzaGroupBy, CobranzaSort> = { ticket: 'days', client: 'balance' };

/** Por cliente sorts the groups by Más antiguo or Saldo total only. */
const CLIENT_SORTS: ReadonlySet<CobranzaSort> = new Set(['balance', 'days']);

/**
 * `?orden=`: the order (`balance`) in its first direction, or with the other one
 * (`balance-asc`); anything else is the view's default.
 */
export const parseCobranzaOrder = (
  value: string | null,
  groupBy: CobranzaGroupBy,
): CobranzaOrder => {
  const [key = '', dir] = (value ?? '').trim().split('-');
  const allowed =
    isCobranzaSort(key) && (groupBy === 'ticket' || CLIENT_SORTS.has(key));
  const sort = allowed ? key : DEFAULT_SORT[groupBy];
  const direction: CobranzaSortDirection =
    allowed && (dir === 'asc' || dir === 'desc') ? dir : COBRANZA_SORT_FIRST_DIRECTION[sort];
  return { sort, direction };
};

/** The `?orden=` value of an order; null for the view's default. */
export const cobranzaOrderParam = (
  { sort, direction }: CobranzaOrder,
  groupBy: CobranzaGroupBy,
): string | null => {
  const first = COBRANZA_SORT_FIRST_DIRECTION[sort];
  if (sort === DEFAULT_SORT[groupBy] && direction === first) return null;
  return direction === first ? sort : `${sort}-${direction}`;
};

/** The table column of each order: Por ticket maps Fecha to `recent`; Por cliente uses the order. */
const sortColumnId = (sort: CobranzaSort, groupBy: CobranzaGroupBy): string =>
  groupBy === 'ticket' ? COBRANZA_SORT_COLUMN[sort] : sort;

const sortOfColumn = (columnId: string, groupBy: CobranzaGroupBy): CobranzaSort | null => {
  if (groupBy === 'client') return isCobranzaSort(columnId) ? columnId : null;
  const entry = Object.entries(COBRANZA_SORT_COLUMN).find(([, column]) => column === columnId);
  return entry ? (entry[0] as CobranzaSort) : null;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

type CobranzaDesktopProps = {
  canWrite: boolean;
  /** False while the phone layout owns the viewport: nothing loads (CobranzaView). */
  enabled?: boolean;
};

/**
 * Cobranza from lg (ZIG-I31-2/3, canvas CobA/CobB; ZIG-I33-3 list standard): the
 * title with the queue count, the aging strip with amounts, the filter row, the
 * queue by ticket or by client sorted from its headers on the server, and the
 * footer with the sum, the En proceso note and the pager. Finished work only.
 */
export const CobranzaDesktop = ({ canWrite, enabled = true }: CobranzaDesktopProps) => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const companyName = selectedCompany?.name ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const bucket = parseCobranzaTramo(searchParams.get('tramo'));
  const groupBy: CobranzaGroupBy = searchParams.get('ver') === 'clientes' ? 'client' : 'ticket';
  const statusRaw = searchParams.get('status');
  // Por cliente has no payment-state filter (canvas CobB); it always shows every saldo.
  const status: CobranzaStatusFilter =
    groupBy === 'ticket' && statusRaw && isCobranzaStatusFilter(statusRaw) ? statusRaw : 'all';
  const { sort, direction } = parseCobranzaOrder(searchParams.get('orden'), groupBy);
  const clientIdParam = searchParams.get('clientId');
  const clientId =
    clientIdParam && /^\d+$/.test(clientIdParam) ? Number(clientIdParam) : null;
  const copy = VIEW_COPY[groupBy];

  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [data, setData] = React.useState<CobranzaPaginatedData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [collectRow, setCollectRow] = React.useState<CobranzaRow | null>(null);
  const requestRef = React.useRef(0);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(searchValue.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  // Any filter or order change goes back to the first page.
  React.useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [bucket, groupBy, status, sort, direction, clientId, debouncedSearch]);

  const replaceParams = React.useCallback(
    (edit: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      edit(params);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setParam = React.useCallback(
    (key: string, value: string | null) =>
      replaceParams((params) => {
        if (value == null) params.delete(key);
        else params.set(key, value);
      }),
    [replaceParams],
  );

  const setView = (next: CobranzaGroupBy) =>
    replaceParams((params) => {
      if (next === 'client') params.set('ver', 'clientes');
      else params.delete('ver');
      // Each view has its own sort; keep only the filters both views share.
      params.delete('orden');
    });

  // The headers sort: the order lives in `?orden=` and the server applies it.
  const sorting = React.useMemo<SortingState>(
    () => [{ id: sortColumnId(sort, groupBy), desc: direction === 'desc' }],
    [direction, groupBy, sort],
  );
  const onSortingChange = React.useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      const nextSort = first ? sortOfColumn(first.id, groupBy) : null;
      if (!first || !nextSort) return;
      setParam(
        'orden',
        cobranzaOrderParam({ sort: nextSort, direction: first.desc ? 'desc' : 'asc' }, groupBy),
      );
    },
    [groupBy, setParam, sorting],
  );

  const load = React.useCallback(async () => {
    if (!enabled) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    const result = await getCobranzaPaginated({
      companyId,
      bucket,
      status,
      search: debouncedSearch,
      sort,
      sortDirection: direction,
      groupBy,
      clientId,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    });
    if (requestId !== requestRef.current) return;
    setLoading(false);
    if (!result.success || !result.data) {
      const errorType = classifyClientError(null, undefined, result.errorType);
      // The error state says it (role=alert); no toast on top (ZIG-I33 §8).
      setLoadError(
        getErrorMessageByType(errorType, result.error || 'No se pudo cargar la cobranza'),
      );
      return;
    }
    setLoadError(null);
    setData(result.data);
  }, [
    bucket,
    clientId,
    companyId,
    debouncedSearch,
    direction,
    enabled,
    groupBy,
    pagination.pageIndex,
    pagination.pageSize,
    sort,
    status,
  ]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const columns = React.useMemo(
    () =>
      createCobranzaColumns({
        onCollect: setCollectRow,
        canWrite,
        companyId,
        companyName,
      }),
    [canWrite, companyId, companyName],
  );

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    pageCount: data?.totalPages ?? 1,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
  });

  const hasFilters =
    bucket !== 'all' || status !== 'all' || debouncedSearch.length > 0 || clientId != null;

  // Limpiar never touches the order (ZIG-I33 §2).
  const clearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    replaceParams((params) => {
      for (const key of ['tramo', 'status', 'clientId']) params.delete(key);
    });
  };

  const nothingOwed = data != null && data.buckets.all.count === 0 && !hasFilters;
  const clientName =
    clientId != null
      ? (data?.rows[0]?.client_name ?? data?.groups[0]?.client_name ?? `#${clientId}`)
      : null;
  const refreshing = data != null && loading;

  const footer = (pageData: CobranzaPaginatedData) => {
    const shown = groupBy === 'client' ? pageData.groups.length : pageData.rows.length;
    const start = (pageData.page - 1) * pageData.pageSize + 1;
    const range =
      pageData.totalPages > 1 ? `${start}–${start + shown - 1}` : String(shown);
    const pager: ListFooterPagination = {
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      pageCount: pageData.totalPages,
      onPageChange: (pageIndex) => setPagination((prev) => ({ ...prev, pageIndex })),
      onPageSizeChange: (pageSize) => setPagination({ pageIndex: 0, pageSize }),
    };
    return (
      <div data-testid="cobranza-footer">
        <ListFooter
          total={pageData.total}
          noun={groupBy === 'client' ? 'clientes' : 'tickets'}
          pagination={pager}
          label={
            groupBy === 'client' ? (
              <>
                {range} de {plural(pageData.total, 'cliente', 'clientes')} ·{' '}
                <FormattedCurrency amount={pageData.totalBalance} /> en{' '}
                {plural(pageData.ticketCount, 'ticket', 'tickets')}
              </>
            ) : (
              <>
                {range} de {plural(pageData.total, 'ticket', 'tickets')} · suman{' '}
                <FormattedCurrency amount={pageData.totalBalance} />
              </>
            )
          }
          extra={
            groupBy === 'client' ? (
              <span>
                Clientes con varios tickets se despliegan; el estado de cuenta va en un solo
                WhatsApp desde el ⋯
              </span>
            ) : pageData.inProgress.count > 0 ? (
              <span className="tabular-nums" data-testid="cobranza-in-progress">
                {pageData.inProgress.count === 1
                  ? '1 ticket en proceso suma '
                  : `${pageData.inProgress.count} tickets en proceso suman `}
                <FormattedCurrency amount={pageData.inProgress.total} />{' '}
                {pageData.inProgress.count === 1
                  ? 'y se cobra al terminarlo'
                  : 'y se cobran al terminarlos'}{' '}
                ·{' '}
                {/* The tickets view that counts the same: unfinished with a saldo. */}
                <Link
                  href="/tickets?status=due&finished=no"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Ver en Tickets
                </Link>
              </span>
            ) : null
          }
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col" data-testid="cobranza-desktop">
      <ListDesktopTitle
        title="Cobranza"
        count={data?.queueCount ?? null}
        description={copy.subtitle}
        actions={
          <div
            role="group"
            aria-label="Agrupar"
            className="inline-flex gap-0.5 rounded-lg bg-slate-100 p-[3px] dark:bg-muted"
          >
            {(
              [
                { value: 'ticket', label: 'Por ticket' },
                { value: 'client', label: 'Por cliente' },
              ] as const
            ).map((option) => {
              const pressed = groupBy === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setView(option.value)}
                  className={cn(
                    'h-8 rounded-md px-3 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:text-[13px]',
                    pressed
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-slate-600 hover:text-foreground dark:text-slate-300',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        }
      />

      <CobranzaAgingStrip
        buckets={data?.buckets ?? null}
        collectedThisMonth={data?.collectedThisMonth ?? null}
        value={bucket}
        onChange={(next) => setParam('tramo', tramoParam(next))}
        controls={TABLE_ID}
        view={groupBy}
      />

      {clientId != null ? (
        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-2 text-sm"
          data-testid="cobranza-client-filter"
        >
          <p>
            Cliente:{' '}
            <Link
              href={`/clients/${clientId}`}
              className="font-semibold underline-offset-4 hover:underline"
            >
              {clientName}
            </Link>
          </p>
          <Button variant="ghost" size="sm" onClick={() => setParam('clientId', null)}>
            Ver todos los clientes
          </Button>
        </div>
      ) : null}

      <div className="mb-3 mt-4">
        <ListToolbar
          search={{
            value: searchValue,
            onChange: setSearchValue,
            placeholder: copy.placeholder,
            ariaLabel: 'Buscar en cobranza',
          }}
          filters={
            groupBy === 'ticket' ? (
              <ListFilterSelect
                value={status}
                allValue="all"
                onChange={(value) => setParam('status', value === 'all' ? null : value)}
                options={STATUS_OPTIONS}
                ariaLabel="Estado de pago"
              />
            ) : null
          }
          hasActiveFilters={hasFilters}
          onClear={clearFilters}
          clearAriaLabel="Limpiar filtros de cobranza"
        />
      </div>

      {/* Always present: the strip tabs point here even while an empty state shows. */}
      <div id={TABLE_ID}>
        {data == null && loading ? (
          <ListLoading label="Cargando cobranza" columns={groupBy === 'client' ? 7 : 8} />
        ) : loadError ? (
          <ListError description={loadError} onRetry={() => void load()} />
        ) : nothingOwed ? (
          <ListEmpty
            icon={<Banknote className="h-4 w-4 text-muted-foreground" aria-hidden />}
            title="Sin saldos pendientes"
            description="Todos tus tickets terminados están pagados."
          />
        ) : data != null && data.total === 0 ? (
          <ListNoResults
            description="Ningún ticket coincide con los filtros actuales."
            onClear={clearFilters}
          />
        ) : data != null ? (
          <ListTableCard footer={footer(data)}>
            {groupBy === 'client' ? (
              <CobranzaClientTable
                groups={data.groups}
                canWrite={canWrite}
                companyId={companyId}
                companyName={companyName}
                onCollect={setCollectRow}
                sorting={sorting}
                onSortingChange={onSortingChange}
                busy={refreshing}
              />
            ) : (
              <CobranzaTicketTable table={table} busy={refreshing} />
            )}
          </ListTableCard>
        ) : null}
      </div>

      {collectRow ? (
        <TicketListCollectPaymentDialog
          open
          onOpenChange={(open) => {
            if (!open) setCollectRow(null);
          }}
          ticketId={Number(collectRow.id)}
          total={collectRow.total}
          paid={collectRow.paid}
          companyId={companyId}
          folio={collectRow.folio}
          clientName={collectRow.client_name}
          clientTel={collectRow.client_tel}
          companyName={companyName}
          settledDescription="La fila sale de Cobranza y la franja se actualiza."
          onPaymentApplied={() => {
            void load();
          }}
        />
      ) : null}
    </div>
  );
};
