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
import { Banknote, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import {
  getCobranzaPaginated,
  type CobranzaGroupBy,
  type CobranzaPaginatedData,
} from '@/actions/cobranza';
import { CobranzaAgingStrip } from '@/components/cobranza/cobranza-aging-strip';
import { CobranzaClientTable } from '@/components/cobranza/cobranza-client-table';
import { createCobranzaColumns } from '@/components/cobranza/cobranza-columns';
import {
  COBRANZA_TABLE_CARD_CLASS,
  CobranzaTicketTable,
} from '@/components/cobranza/cobranza-ticket-table';
import { FormattedCurrency } from '@/components/formatted-currency';
import { TicketListCollectPaymentDialog } from '@/components/tickets/ticket-list-collect-payment-dialog';
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
  isCobranzaStatusFilter,
  type CobranzaAgingBucket,
  type CobranzaRow,
  type CobranzaSort,
  type CobranzaStatusFilter,
} from '@/lib/cobranza';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { cn } from '@/lib/utils';

const TABLE_ID = 'cobranza-desktop-table';
const PAGE_SIZE = 25;

const STATUS_OPTIONS: Array<{ value: CobranzaStatusFilter; label: string }> = [
  { value: 'all', label: 'Pendientes y parciales' },
  { value: 'pending', label: 'Solo pendientes' },
  { value: 'partial', label: 'Solo parciales' },
];

/** Desktop labels of the canvas; the phone keeps its own (COBRANZA_SORT_OPTIONS). */
const TICKET_SORT_OPTIONS: Array<{ value: CobranzaSort; label: string }> = [
  { value: 'days', label: 'Más días sin pagar' },
  { value: 'balance', label: 'Mayor saldo' },
  { value: 'recent', label: 'Más recientes' },
];

/** Por cliente sorts the groups: Mayor saldo first (canvas CobB), or the oldest work. */
const CLIENT_SORT_OPTIONS: Array<{ value: CobranzaSort; label: string }> = [
  { value: 'balance', label: 'Mayor saldo' },
  { value: 'days', label: 'Más días sin pagar' },
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

/** `?orden=` per view; each view drops its own default from the URL. */
const DEFAULT_SORT: Record<CobranzaGroupBy, CobranzaSort> = { ticket: 'days', client: 'balance' };

const parseSort = (value: string | null, groupBy: CobranzaGroupBy): CobranzaSort => {
  const options = groupBy === 'client' ? CLIENT_SORT_OPTIONS : TICKET_SORT_OPTIONS;
  return options.some((option) => option.value === value)
    ? (value as CobranzaSort)
    : DEFAULT_SORT[groupBy];
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

type CobranzaDesktopProps = {
  canWrite: boolean;
};

/**
 * Cobranza from md (ZIG-I31-2/3, canvas CobA/CobB): aging strip with amounts,
 * the queue by ticket or by client, and the En proceso footnote. Finished work only.
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
  // Por cliente has no payment-state filter (canvas CobB); it always shows every saldo.
  const status: CobranzaStatusFilter =
    groupBy === 'ticket' && statusRaw && isCobranzaStatusFilter(statusRaw) ? statusRaw : 'all';
  const sort = parseSort(searchParams.get('orden'), groupBy);
  const clientIdParam = searchParams.get('clientId');
  const clientId =
    clientIdParam && /^\d+$/.test(clientIdParam) ? Number(clientIdParam) : null;
  const copy = VIEW_COPY[groupBy];
  const sortOptions = groupBy === 'client' ? CLIENT_SORT_OPTIONS : TICKET_SORT_OPTIONS;

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
    const timeoutId = window.setTimeout(() => setDebouncedSearch(searchValue.trim()), 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  // Any filter change goes back to the first page.
  React.useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [bucket, groupBy, status, sort, clientId, debouncedSearch]);

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

  const hasFilters =
    bucket !== 'all' || status !== 'all' || debouncedSearch.length > 0 || clientId != null;

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
  const shown = groupBy === 'client' ? (data?.groups.length ?? 0) : (data?.rows.length ?? 0);
  const totalPages = data?.totalPages ?? 1;
  const pageIndex = pagination.pageIndex;

  return (
    <div className="flex flex-col" data-testid="cobranza-desktop">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Cobranza</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{copy.subtitle}</p>
        </div>
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
                  'h-8 rounded-md px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
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
      </div>

      <div className="mt-[18px]">
        <CobranzaAgingStrip
          buckets={data?.buckets ?? null}
          collectedThisMonth={data?.collectedThisMonth ?? null}
          value={bucket}
          onChange={(next) => setParam('tramo', tramoParam(next))}
          controls={TABLE_ID}
          view={groupBy}
        />
      </div>

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

      <div className="mb-3 mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] max-w-[340px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={copy.placeholder}
            aria-label="Buscar en cobranza"
            className="h-10 rounded-[10px] pl-9"
          />
        </div>
        {groupBy === 'ticket' ? (
          <Select
            value={status}
            onValueChange={(value) => setParam('status', value === 'all' ? null : value)}
          >
            <SelectTrigger className="h-10 w-auto gap-2 rounded-[10px] font-medium" aria-label="Estado de pago">
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
        ) : null}
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
        <span className="flex-1" aria-hidden />
        <Select
          value={sort}
          onValueChange={(value) =>
            setParam('orden', value === DEFAULT_SORT[groupBy] ? null : value)
          }
        >
          <SelectTrigger className="h-10 w-auto gap-2 rounded-[10px] font-medium" aria-label="Ordenar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <div className={COBRANZA_TABLE_CARD_CLASS}>
            {groupBy === 'client' ? (
              <CobranzaClientTable
                groups={data.groups}
                canWrite={canWrite}
                companyName={companyName}
                onCollect={setCollectRow}
              />
            ) : (
              <CobranzaTicketTable table={table} />
            )}
            <div
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border/70 px-4 py-3 text-[13px] text-muted-foreground"
              data-testid="cobranza-footer"
            >
              <div className="flex items-center gap-3">
                <span className="tabular-nums">
                  {groupBy === 'client' ? (
                    <>
                      {shown} de {plural(data.total, 'cliente', 'clientes')} ·{' '}
                      <FormattedCurrency amount={data.totalBalance} /> en{' '}
                      {plural(data.ticketCount, 'ticket', 'tickets')}
                    </>
                  ) : (
                    <>
                      {shown} de {plural(data.total, 'ticket', 'tickets')} · suman{' '}
                      <FormattedCurrency amount={data.totalBalance} />
                    </>
                  )}
                </span>
                {totalPages > 1 ? (
                  <span className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => table.previousPage()}
                      disabled={pageIndex === 0}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                    </Button>
                    <span className="tabular-nums">
                      {pageIndex + 1} / {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => table.nextPage()}
                      disabled={pageIndex + 1 >= totalPages}
                      aria-label="Página siguiente"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Button>
                  </span>
                ) : null}
              </div>
              {groupBy === 'client' ? (
                <span>
                  Clientes con varios tickets se despliegan; «Estado de cuenta» manda un solo
                  WhatsApp con todos
                </span>
              ) : data.inProgress.count > 0 ? (
                <span className="tabular-nums" data-testid="cobranza-in-progress">
                  {data.inProgress.count === 1
                    ? '1 ticket en proceso suma '
                    : `${data.inProgress.count} tickets en proceso suman `}
                  <FormattedCurrency amount={data.inProgress.total} />{' '}
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
                </span>
              ) : null}
            </div>
          </div>
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
