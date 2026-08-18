'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Package, RotateCcw, Ticket, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormattedCurrency } from '@/components/formatted-currency';
import { FormattedDate } from '@/components/formatted-date';
import { TripledEmptyState } from '@/components/tripled';
import {
  getTrash,
  restoreClient,
  restoreService,
  restoreTicket,
  type TrashContents,
} from '@/actions/trash';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { presentActionError } from '@/lib/network-awareness';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { SystemCompanyContextEmptyState } from '@/components/system-company-context-empty-state';

const EMPTY_TRASH: TrashContents = {
  clients: [],
  services: [],
  tickets: [],
};

type RestoreFn = (
  id: number,
  companyId?: number | null,
) => Promise<{ success: boolean; error?: string }>;

export const TrashView = () => {
  const { selectedCompany } = useCompany();
  const { isSystem } = usePermissions();
  const missingCompany = needsSelectedCompanyContext(
    isSystem,
    selectedCompany?.id,
  );
  const companyId = selectedCompany?.id ?? null;
  const [data, setData] = React.useState<TrashContents>(EMPTY_TRASH);
  const [loading, setLoading] = React.useState(!missingCompany);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const loadTrash = React.useCallback(async () => {
    if (missingCompany) {
      setData(EMPTY_TRASH);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getTrash(companyId);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setData(EMPTY_TRASH);
        if (result.error) {
          const content = presentActionError(result, 'No se pudo cargar la papelera');
          toast.error(content.title, { description: content.description });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, missingCompany]);

  React.useEffect(() => {
    void loadTrash();
  }, [loadTrash]);

  const handleRestore = async (
    key: string,
    id: number,
    restoreFn: RestoreFn,
  ) => {
    setPendingId(key);
    try {
      const result = await restoreFn(id, companyId);
      if (!result.success) {
        const content = presentActionError(result, 'No se pudo restaurar el registro');
        toast.error(content.title, { description: content.description });
        return;
      }
      toast.success('Registro restaurado');
      await loadTrash();
    } finally {
      setPendingId(null);
    }
  };

  if (missingCompany) {
    return <SystemCompanyContextEmptyState resourceLabel="registros eliminados" />;
  }

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Cargando papelera…
      </p>
    );
  }

  const isEmpty =
    data.clients.length === 0 &&
    data.services.length === 0 &&
    data.tickets.length === 0;

  if (isEmpty) {
    return (
      <TripledEmptyState
        icon={<Trash2 className="h-4 w-4" data-icon="inline-start" />}
        title="Papelera vacía"
        description="No hay registros eliminados para restaurar."
      />
    );
  }

  return (
    <div className="space-y-8">
      {data.tickets.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Ticket className="size-4" aria-hidden /> Tickets
          </h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
            {data.tickets.map((row) => {
              const key = `ticket-${row.id}`;
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      Ticket #{row.id} · {row.client_name ?? 'Sin cliente'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <FormattedCurrency amount={row.total} /> · Eliminado{' '}
                      <FormattedDate date={row.deleted_at} />
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={pendingId === key}
                    onClick={() =>
                      handleRestore(key, Number(row.id), restoreTicket)
                    }
                  >
                    <RotateCcw
                      className="size-3.5"
                      aria-hidden
                      data-icon="inline-start"
                    />
                    Restaurar
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {data.clients.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <User className="size-4" aria-hidden /> Clientes
          </h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
            {data.clients.map((row) => {
              const key = `client-${row.id}`;
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.email ?? row.phone ?? 'Sin contacto'} · Eliminado{' '}
                      <FormattedDate date={row.deleted_at} />
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={pendingId === key}
                    onClick={() => handleRestore(key, row.id, restoreClient)}
                  >
                    <RotateCcw
                      className="size-3.5"
                      aria-hidden
                      data-icon="inline-start"
                    />
                    Restaurar
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {data.services.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Package className="size-4" aria-hidden /> Servicios
          </h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
            {data.services.map((row) => {
              const key = `service-${row.id}`;
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <FormattedCurrency amount={row.price} /> · Eliminado{' '}
                      <FormattedDate date={row.deleted_at} />
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={pendingId === key}
                    onClick={() => handleRestore(key, row.id, restoreService)}
                  >
                    <RotateCcw
                      className="size-3.5"
                      aria-hidden
                      data-icon="inline-start"
                    />
                    Restaurar
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
