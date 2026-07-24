'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { applyTicketPayment } from '@/actions/tickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormattedCurrency } from '@/components/formatted-currency';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { Loader2, Wallet } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FormattedDate } from '@/components/formatted-date';
import { usePermissions } from '@/hooks/use-permissions';
import { canCollectTicketPayment } from '@/lib/tickets-rbac';
import { getErrorMessageByType } from '@/lib/network-awareness';
import { TripledEmptyState } from '@/components/tripled';

type TicketPaymentHistoryRow = {
  id: number;
  amount: number;
  created_at: Date | string;
};

type TicketPaymentCollectSectionProps = {
  ticketId: number;
  total: number | null;
  paid: number | null;
  finished: boolean;
  payments: TicketPaymentHistoryRow[];
};

export const TicketPaymentCollectSection = ({
  ticketId,
  total,
  paid,
  finished,
  payments,
}: TicketPaymentCollectSectionProps) => {
  const router = useRouter();
  const { can } = usePermissions();
  const canCollect = canCollectTicketPayment(can);
  const [amountInput, setAmountInput] = React.useState('');
  const [isPending, startTransition] = React.useTransition();

  const balanceDue = getTicketBalanceDue(total, paid);
  const paymentStatus = getTicketPaymentStatus(total, paid);
  const showCollectUi = finished && paymentStatus === 'partial' && canCollect;

  const parseAmount = (value: string): number => {
    if (!value.trim()) return 0;
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(parsed, 0);
  };

  const handleApplyPayment = () => {
    const additional = parseAmount(amountInput);
    if (additional <= 0) {
      toast.error('Ingresa un monto mayor a cero. Código: TC009');
      return;
    }
    if (additional > balanceDue + 1e-9) {
      toast.error('El monto no puede superar el saldo pendiente. Código: TC009');
      return;
    }

    startTransition(async () => {
      const result = await applyTicketPayment(ticketId, additional);
      if (result.success) {
        toast.success('Cobro registrado correctamente');
        setAmountInput('');
        router.refresh();
        return;
      }
      toast.error(
        getErrorMessageByType(
          result.errorType ?? 'server',
          result.error ?? 'No se pudo registrar el cobro',
        ),
      );
    });
  };

  const handleSettleFull = () => {
    if (balanceDue <= 0) return;

    startTransition(async () => {
      const result = await applyTicketPayment(ticketId, balanceDue);
      if (result.success) {
        toast.success('Ticket saldado');
        setAmountInput('');
        router.refresh();
        return;
      }
      toast.error(
        getErrorMessageByType(
          result.errorType ?? 'server',
          result.error ?? 'No se pudo saldar el ticket',
        ),
      );
    });
  };

  if (!finished) {
    return null;
  }

  return (
    <div className="space-y-3" id="cobranza">
      <label className="text-sm font-medium text-foreground">Cobranza</label>
      {paymentStatus === 'paid' ? (
        <div className="grid gap-3 rounded-md border-2 border-muted bg-muted/30 p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total cobrado</p>
            <p className="font-medium">
              <FormattedCurrency amount={paid} />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className="font-medium text-emerald-700 dark:text-emerald-300">
              Pago completado
            </p>
            <p className="text-xs text-muted-foreground">
              Sin saldo pendiente
            </p>
          </div>
        </div>
      ) : paymentStatus === 'partial' ? (
        <div className="grid gap-3 rounded-md border-2 border-muted bg-muted/30 p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Pagado</p>
            <p className="font-medium">
              <FormattedCurrency amount={paid} />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Saldo pendiente</p>
            <p className="font-medium">
              <FormattedCurrency amount={balanceDue} />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-medium">
              <FormattedCurrency amount={total} />
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 rounded-md border-2 border-muted bg-muted/30 p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total a cobrar</p>
            <p className="font-medium">
              <FormattedCurrency amount={total} />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className="font-medium">Sin pagos registrados</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Historial de abonos
        </p>
        {payments.length === 0 ? (
          <TripledEmptyState
            icon={<Wallet className="h-4 w-4" />}
            title="Sin abonos"
            description="No hay abonos registrados en el historial."
          />
        ) : (
          <>
            <ul className="divide-y divide-border rounded-md border md:hidden">
              {payments.map((row) => {
                const paymentDate =
                  typeof row.created_at === 'string'
                    ? new Date(row.created_at)
                    : row.created_at;

                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 text-muted-foreground">
                      <FormattedDate withTime date={paymentDate} />
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      <FormattedCurrency amount={row.amount} />
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="hidden rounded-md border md:block">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">
                      <FormattedDate
                        withTime
                        date={
                          typeof row.created_at === 'string'
                            ? new Date(row.created_at)
                            : row.created_at
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      <FormattedCurrency amount={row.amount} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {showCollectUi && (
        <div className="space-y-3 rounded-md border bg-background p-4">
          <p className="text-sm font-medium text-foreground">
            Registrar cobro
          </p>
          <p className="text-xs text-muted-foreground">
            Puedes abonar una parte del saldo o saldar el ticket por completo.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label htmlFor="ticket-additional-payment" className="sr-only">
                Monto a abonar
              </label>
              <Input
                id="ticket-additional-payment"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                disabled={isPending}
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleApplyPayment();
                  }
                }}
                aria-label="Monto a abonar"
                placeholder="Monto a abonar"
                className="h-11"
              />
            </div>
            <Button
              type="button"
              className="h-11 sm:min-w-[120px]"
              disabled={isPending}
              onClick={handleApplyPayment}
              aria-label="Registrar abono al saldo del ticket"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" data-icon="inline-start"/>
              ) : (
                'Abonar'
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-11 sm:min-w-[160px]"
              disabled={isPending}
              onClick={handleSettleFull}
              aria-label="Saldar el ticket por completo"
            >
              Saldar por completo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
