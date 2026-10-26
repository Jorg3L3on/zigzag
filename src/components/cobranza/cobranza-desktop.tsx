'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  getCoreRowModel,
  useReactTable,
  type PaginationState,
} from '@tanstack/react-table';
import { Banknote, Search } from 'lucide-react';
import {
  getCobranzaPaginated,
  type CobranzaGroupBy,
  type CobranzaPaginatedData,
} from '@/actions/cobranza';
import { CobranzaAgingStrip } from '@/components/cobranza/cobranza-aging-strip';
import { CobranzaClientTable } from '@/components/cobranza/cobranza-client-table';
import { createCobranzaColumns } from '@/components/cobranza/cobranza-columns';
import { CobranzaTicketTable } from '@/components/cobranza/cobranza-ticket-table';
import { FormattedCurrency } from '@/components/formatted-currency';
import { FILTER_SELECTED_CLASS } from '@/components/list-filter';
import { TicketListCollectPaymentDialog } from '@/components/tickets/ticket-list-collect-payment-dialog';
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
import { useCompany } from '@/contexts/company-context';
import {
  COBRANZA_SORT_OPTIONS,
  isCobranzaStatusFilter,
  type CobranzaAgingBucket,
  type CobranzaRow,
  type CobranzaSort,
  type CobranzaStatusFilter,
} from '@/lib/cobranza';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { cn } from '@/lib/utils';

const TABLE_ID = 'cobranza-desktop-table';

const STATUS_OPTIONS: Array<{ value: CobranzaStatusFilter; label: string }> = [
  { value: 'all', label: 'Pendientes y parciales' },
  { value: 'pending', label: 'Solo pendientes' },
  { value: 'partial', label: 'Solo parciales' },
];

/** `?tramo=`; a typed `90+` reaches us as `90 ` because `+` decodes to a space. */
export const parseCobranzaTramo = (value: string | null): CobranzaAgingBucket => {
  const raw = value?.trim();
  if (raw === '0-30' || raw === '31-90') return raw;
  if (raw === '90+' || raw === '90') return '90+';
  return 'all';
};

const tramoParam = (bucket: CobranzaAgingBucket): string | null =>
  bucket === 'all' ? null : bucket;

const parseSort = (value: string | null): CobranzaSort =>
  value === 'balance' || value === 'recent' ? value : 'days';

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

type CobranzaDesktopProps = {
  canWrite: boolean;
};

/**
 * Cobranza from md (ZIG-I31-2/3): aging strip with amounts, the queue by
 * ticket or by client, and the En proceso footnote. Finished work only.
 */
export const CobranzaDesktop = ({ canWrite }: CobranzaDesktopProps) => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const companyName = selectedCompany?.name ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const bucket = parseCobranzaTramo(searchParams.get('tramo'));
  const groupBy: CobranzaGroupBy = searchParams.get('ver') === 'clientes' ? 'client' : 'ticket';
  const statusRaw = searchParams.get('status');
  const status: CobranzaStatusFilter =
    statusRaw && isCobranzaStatusFilter(statusRaw) ? statusRaw : 'all';
  const sort = parseSort(searchParams.get('orden'));
  const clientIdParam = searchParams.get('clientId');
  const clientId =
    clientIdParam && /^\d+$/.test(clientIdParam) ? Number(clientIdParam) : null;

  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [data, setData] = React.useState<CobranzaPaginatedData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [collectRow, setCollectRow] = React.useState<CobranzaRow | null>(null);
  const requestRef = React.useRef(0);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(searchValue.trim()), 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  // Any filter change goes back to the first page.
  React.useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [bucket, groupBy, status, sort, clientId, debouncedSearch]);

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value == null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const load = React.useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    const result = await getCobranzaPaginated({
      companyId,
      bucket,
      status,
      search: debouncedSearch,
      sort,
      groupBy,
      clientId,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    });
    if (requestId !== requestRef.current) return;
    setLoading(false);
    if (!result.success || !result.data) {
      const errorType = classifyClientError(null, undefined, result.errorType);
      const message = getErrorMessageByType(
        errorType,
        result.error || 'No se pudo cargar la cobranza',
      );
      setLoadError(message);
      toast.error(message);
      return;
    }
    setLoadError(null);
    setData(result.data);
  }, [
    bucket,
    clientId,
    companyId,
    debouncedSearch,
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
    pageCount: data?.totalPages ?? 1,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  });

  // The client view paginates the groups; the pager only needs the same state.
  const groupTable = useReactTable({
    data: data?.groups ?? [],
    columns: [],
    manualPagination: true,
    pageCount: data?.totalPages ?? 1,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  });

  const hasFilters =
    bucket !== 'all' || status !== 'all' || debouncedSearch.length > 0 || clientId != null;

  const clearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ['tramo', 'status', 'clientId']) params.delete(key);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const nothingOwed = data != null && data.buckets.all.count === 0 && !hasFilters;
  const clientName =
    clientId != null
      ? (data?.rows[0]?.client_name ?? data?.groups[0]?.client_name ?? `#${clientId}`)
      : null;

  return (
    <div className="flex flex-col gap-5" data-testid="cobranza-desktop">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Cobranza</h1>
          <p className="text-sm text-muted-foreground">
            Saldos de tickets terminados: quién te debe, cuánto y desde cuándo. Lo que sigue en
            proceso se cobra al terminar.
          </p>
        </div>
        <div
          role="group"
          aria-label="Ver la cobranza"
          className="inline-flex rounded-lg border border-border/70 p-0.5"
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
                onClick={() => setParam('ver', option.value === 'client' ? 'clientes' : null)}
                className={cn(
                  'min-h-9 rounded-md border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                  pressed
                    ? FILTER_SELECTED_CLASS
                    : 'border-transparent text-muted-foreground hover:bg-muted/50',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <CobranzaAgingStrip
        buckets={data?.buckets ?? null}
        collectedThisMonth={data?.collectedThisMonth ?? null}
        value={bucket}
        onChange={(next) => setParam('tramo', tramoParam(next))}
        controls={TABLE_ID}
      />

      {clientId != null ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-2 text-sm"
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Buscar por cliente, folio o teléfono"
            aria-label="Buscar en cobranza"
            className="h-10 pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => setParam('status', value === 'all' ? null : value)}
        >
          <SelectTrigger className="h-10 w-[13rem]" aria-label="Estado de pago">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(value) => setParam('orden', value === 'days' ? null : value)}
        >
          <SelectTrigger className="h-10 w-[12rem]" aria-label="Ordenar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COBRANZA_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={clearFilters}
          >
            Limpiar
          </Button>
        ) : null}
      </div>

      {/* Always present: the strip tabs point here even while an empty state shows. */}
      <div
        id={TABLE_ID}
        className={cn('transition-opacity', data != null && loading && 'opacity-60')}
        aria-busy={loading || undefined}
      >
        {data == null && loading ? (
          <TripledListLoadingState label="Cargando cobranza…" desktopColumns={7} />
        ) : data == null && loadError ? (
          <TripledEmptyState
            icon={<Banknote className="size-8" aria-hidden />}
            title="No se pudo cargar"
            description={loadError}
            action={
              <Button type="button" variant="outline" onClick={() => void load()}>
                Reintentar
              </Button>
            }
          />
        ) : nothingOwed ? (
          <TripledEmptyState
            icon={<Banknote className="size-8" aria-hidden />}
            title="No hay saldos pendientes"
            description="Todos tus tickets terminados están pagados."
          />
        ) : data != null && data.total === 0 ? (
          <TripledEmptyState
            icon={<Banknote className="size-8" aria-hidden />}
            title="Sin resultados"
            description="Ningún ticket coincide con los filtros actuales."
            action={
              <Button type="button" variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            }
          />
        ) : data != null ? (
          <>
            {groupBy === 'client' ? (
              <CobranzaClientTable
                groups={data.groups}
                canWrite={canWrite}
                companyId={companyId}
                companyName={companyName}
                onCollect={setCollectRow}
              />
            ) : (
              <CobranzaTicketTable table={table} />
            )}
            {groupBy === 'client' ? (
              <TicketsListPagination
                table={groupTable}
                variant="desktop"
                totalCount={data.total}
                noun="clientes"
              />
            ) : (
              <TicketsListPagination table={table} variant="desktop" totalCount={data.total} />
            )}
          </>
        ) : null}
      </div>

      {data != null ? (
        <div
          className="flex flex-col gap-1 text-sm text-muted-foreground"
          data-testid="cobranza-footer"
        >
          <p className="tabular-nums">
            {plural(data.total, groupBy === 'client' ? 'cliente' : 'ticket', groupBy === 'client' ? 'clientes' : 'tickets')}{' '}
            · suman{' '}
            <span className="font-semibold text-foreground">
              <FormattedCurrency amount={data.totalBalance} />
            </span>
          </p>
          {data.inProgress.count > 0 ? (
            <p data-testid="cobranza-in-progress">
              {data.inProgress.count === 1
                ? '1 ticket en proceso suma '
                : `${data.inProgress.count} tickets en proceso suman `}
              <span className="tabular-nums">
                <FormattedCurrency amount={data.inProgress.total} />
              </span>{' '}
              {data.inProgress.count === 1
                ? 'y se cobra al terminarlo'
                : 'y se cobran al terminarlos'}{' '}
              ·{' '}
              <Link
                href="/tickets?finished=no"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Ver en Tickets
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

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
          onPaymentApplied={() => {
            void load();
          }}
        />
      ) : null}
    </div>
  );
};
