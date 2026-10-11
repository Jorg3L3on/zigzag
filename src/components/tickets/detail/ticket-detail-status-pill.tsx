import {
  getTicketPaymentStatus,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

type TicketDetailStatusPillProps = {
  finished: boolean;
  total: number | null;
  paid: number | null;
  className?: string;
};

const PILL_LABEL: Record<TicketPaymentStatus, string> = {
  paid: 'Pagado',
  partial: 'Pago parcial',
  pending: 'Sin pagos',
};

const PILL_CLASS: Record<TicketPaymentStatus | 'working', string> = {
  paid: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  partial: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  pending: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  working: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
};

/** Pagado / Pago parcial / Sin pagos, or En proceso until the ticket is finalized. */
export const TicketDetailStatusPill = ({
  finished,
  total,
  paid,
  className,
}: TicketDetailStatusPillProps) => {
  const status = getTicketPaymentStatus(total, paid);
  const label = finished ? PILL_LABEL[status] : 'En proceso';
  return (
    <span
      data-testid="ticket-status-pill"
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        PILL_CLASS[finished ? status : 'working'],
        className,
      )}
    >
      {label}
    </span>
  );
};
