'use client';

import { Badge } from '@/components/ui/badge';
import {
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_LABEL,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

type TicketDetailStatusChipProps = {
  finished: boolean;
  total: number | null;
  paid: number | null;
  className?: string;
};

export const TicketDetailStatusChip = ({
  finished,
  total,
  paid,
  className,
}: TicketDetailStatusChipProps) => {
  const paymentStatus = getTicketPaymentStatus(total, paid);
  const paymentLabel = TICKET_PAYMENT_STATUS_LABEL[paymentStatus];
  const workLabel = finished ? 'Finalizado' : 'En proceso';
  const isSaldado = paymentStatus === 'paid';

  return (
    <Badge
      variant="secondary"
      className={cn(
        'border-transparent font-medium',
        finished && isSaldado
          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-100'
          : finished
            ? 'bg-amber-100 text-amber-950 dark:bg-amber-950/80 dark:text-amber-100'
            : 'bg-sky-100 text-sky-900 dark:bg-sky-950/80 dark:text-sky-100',
        className,
      )}
    >
      {workLabel} · {paymentLabel}
    </Badge>
  );
};
