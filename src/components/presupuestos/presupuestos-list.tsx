'use client';

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock, ChevronRight, FileText, Plus, Search } from 'lucide-react';
import {
  getPresupuestosList,
  type PresupuestoListItem,
} from '@/actions/presupuestos';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PDFDownloadButton } from '@/components/pdf-download-button';
import { FormattedCurrency } from '@/components/formatted-currency';
import {
  TripledEmptyState,
  TripledListLoadingState,
} from '@/components/tripled';
import { ListFilterBarShell } from '@/components/list-filter';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { filterPresupuestosBySearch } from '@/lib/presupuestos-search';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { canWriteTickets } from '@/lib/tickets-rbac';
import type { PresupuestoStatus } from '@/lib/ticket-document-kind';
import { cn } from '@/lib/utils';

const statusVariant = (
  status: PresupuestoListItem['status'],
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'cancelado') return 'outline';
  if (status === 'vencido') return 'destructive';
  if (status === 'convertido') return 'secondary';
  return 'default';
};

const shortDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : format(date, "d MMM yy", { locale: es });
};

const STATUS_FILTERS: Array<{ status: PresupuestoStatus; label: string }> = [
  { status: 'abierto', label: 'Abiertos' },
  { status: 'vencido', label: 'Vencidos' },
  { status: 'convertido', label: 'Convertidos' },
  { status: 'cancelado', label: 'Cancelados' },
];

/** Open pipeline by default: Abiertos + Vencidos (ZIG-I5-5). */
export const DEFAULT_PRESUPUESTO_FILTER: PresupuestoStatus[] = ['abierto', 'vencido'];

/**
 * Presupuestos list (ZIG-I5-5): status chips (multi-select) over tappable rows
 * that open /presupuestos/[id]; PDF stays as a row action. Convertir and
 * Cancelar live on the detail page behind confirmations.
 */
export const PresupuestosList = () => {
  const { selectedCompany } = useCompany();
  const { can, isSystem, loading: permissionsLoading } = usePermissions();
  const canWrite = canWriteTickets(can);
  const missingCompany = needsSelectedCompanyContext(
    isSystem,
    selectedCompany?.id,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<PresupuestoListItem[]>([]);
  const [filter, setFilter] = React.useState<PresupuestoStatus[]>(
    DEFAULT_PRESUPUESTO_FILTER,
  );
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  React.useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(searchValue.trim()),
      300,
    );
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const load = React.useCallback(async () => {
    if (permissionsLoading) return;
    if (missingCompany) {
      setLoading(false);
      setItems([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getPresupuestosList(selectedCompany?.id ?? null);
      if (!result.success || !result.data) {
        setError(
          getErrorDisplayMessage(result, 'No se pudieron cargar los presupuestos'),
        );
        setItems([]);
        return;
      }
      setItems(result.data);
    } catch {
      setError('No se pudieron cargar los presupuestos');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [missingCompany, permissionsLoading, selectedCompany?.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const counts = React.useMemo(() => {
    const next: Record<PresupuestoStatus, number> = {
      abierto: 0,
      vencido: 0,
      convertido: 0,
      cancelado: 0,
    };
    items.forEach((item) => {
      next[item.status] += 1;
    });
    return next;
  }, [items]);

  const visible = React.useMemo(
    () =>
      filterPresupuestosBySearch(
        items.filter((item) => filter.includes(item.status)),
        debouncedSearch,
      ),
    [items, filter, debouncedSearch],
  );

  const clearSearch = () => {
    setSearchValue('');
    setDebouncedSearch('');
  };

  const toggleFilter = (status: PresupuestoStatus) =>
    setFilter((current) =>
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status],
    );

  if (permissionsLoading) {
    return <TripledListLoadingState label="Cargando presupuestos…" />;
  }

  if (missingCompany) {
    return (
      <TripledEmptyState
        icon={<FileText className="h-4 w-4" />}
        title="Selecciona una empresa"
        description="Selecciona una empresa para ver presupuestos."
      />
    );
  }

  if (error) {
    return (
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
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Cotizaciones. No cuentan en cobranza ni en trabajo de hoy hasta convertirlas.
        </p>
        {canWrite ? (
          <Button asChild className="min-h-11 sm:min-h-9">
            <Link href="/presupuestos/create">
              <Plus className="h-4 w-4" aria-hidden data-icon="inline-start" />
              Nuevo presupuesto
            </Link>
          </Button>
        ) : null}
      </div>

      {loading || items.length > 0 ? (
        <ListFilterBarShell
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Buscar presupuestos…"
          searchAriaLabel="Buscar presupuestos por cliente, ID o teléfono"
          showFilterSheet={false}
          sheetFilterCount={0}
          sheetDescription=""
          hasActiveFilters={debouncedSearch.length > 0}
          onClearFilters={clearSearch}
          clearFiltersAriaLabel="Limpiar búsqueda"
          filterChips={
            debouncedSearch
              ? [{ key: 'search', label: `Búsqueda: ${debouncedSearch}` }]
              : []
          }
          sheetContent={null}
          desktopContent={null}
        />
      ) : null}

      {loading ? (
        <TripledListLoadingState label="Cargando presupuestos…" />
      ) : items.length === 0 ? (
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
        <>
          <div
            role="group"
            aria-label="Filtrar por estado"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {STATUS_FILTERS.map(({ status, label }) => {
              const pressed = filter.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => toggleFilter(status)}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                    pressed
                      ? 'border-primary/50 bg-primary/10 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {counts[status]}
                  </span>
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            debouncedSearch ? (
              <TripledEmptyState
                icon={<Search className="h-4 w-4" />}
                title="Sin resultados"
                description={`Ningún presupuesto coincide con “${debouncedSearch}” en los estados activos.`}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearSearch}
                  >
                    Limpiar búsqueda
                  </Button>
                }
              />
            ) : (
              <TripledEmptyState
                icon={<FileText className="h-4 w-4" />}
                title="Nada en este filtro"
                description="Activa otro estado arriba para ver más presupuestos."
              />
            )
          ) : (
            <ul
              aria-label="Presupuestos"
              className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card"
            >
              {visible.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 pr-2"
                  data-testid="presupuesto-row"
                >
                  <Link
                    href={`/presupuestos/${item.id}`}
                    aria-label={`Presupuesto #${item.id} · ${item.clientName ?? 'Sin cliente'} · ${item.statusLabel}`}
                    className="flex min-w-0 flex-1 items-center gap-2 py-3 pl-4 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-medium text-foreground">
                          {item.clientName ?? 'Sin cliente'}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          <FormattedCurrency amount={item.total ?? 0} />
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                        <Badge
                          variant={statusVariant(item.status)}
                          className="h-5 px-1.5 text-[11px] shadow-none"
                        >
                          {item.statusLabel}
                        </Badge>
                        <span>#{item.id}</span>
                        {item.ticketDate ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{shortDate(item.ticketDate)}</span>
                          </>
                        ) : null}
                        {item.expiresAt ? (
                          <>
                            <span aria-hidden>·</span>
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" aria-hidden />
                              Vence {shortDate(item.expiresAt)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                  <PDFDownloadButton
                    ticketId={item.id}
                    downloadFileName={`presupuesto_${item.id}.pdf`}
                    companyId={selectedCompany?.id}
                    variant="ghost"
                    className="h-10 w-10"
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};
