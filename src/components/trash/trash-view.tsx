'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Package, RotateCcw, Ticket, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormattedCurrency } from '@/components/formatted-currency';
import { FormattedDate } from '@/components/formatted-date';
import { TripledEmptyState } from '@/components/tripled';
import {
  restoreClient,
  restoreService,
  restoreTicket,
  type TrashContents,
} from '@/actions/trash';

interface TrashViewProps {
  data: TrashContents;
}

type RestoreFn = (id: number) => Promise<{ success: boolean; error?: string }>;

export const TrashView = ({ data }: TrashViewProps) => {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const handleRestore = async (
    key: string,
    id: number,
    restoreFn: RestoreFn,
  ) => {
    setPendingId(key);
    try {
      const result = await restoreFn(id);
      if (!result.success) {
        toast.error(result.error || 'No se pudo restaurar el registro');
        return;
      }
      toast.success('Registro restaurado');
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const isEmpty =
    data.clients.length === 0 &&
    data.services.length === 0 &&
    data.tickets.length === 0;

  if (isEmpty) {
    return (
      <TripledEmptyState
        icon={<Trash2 className="h-4 w-4"  data-icon="inline-start" />}
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
                    <RotateCcw className="size-3.5" aria-hidden  data-icon="inline-start" />
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
                    <RotateCcw className="size-3.5" aria-hidden  data-icon="inline-start" />
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
                    <RotateCcw className="size-3.5" aria-hidden  data-icon="inline-start" />
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
