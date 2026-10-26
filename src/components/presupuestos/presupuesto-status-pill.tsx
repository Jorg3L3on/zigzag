import { PRESUPUESTO_STATUS_LABEL, type PresupuestoStatus } from '@/lib/ticket-document-kind';
import { cn } from '@/lib/utils';

const STATUS_PILL_CLASS: Record<PresupuestoStatus, string> = {
  abierto: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  vencido: 'bg-red-500/15 text-red-700 dark:text-red-300',
  convertido: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  cancelado: 'bg-slate-500/10 text-muted-foreground',
};

export const PresupuestoStatusPill = ({
  status,
  className,
}: {
  status: PresupuestoStatus;
  className?: string;
}) => (
  <span
    data-testid="presupuesto-status"
    className={cn(
      'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-caption font-semibold',
      STATUS_PILL_CLASS[status],
      className,
    )}
  >
    {PRESUPUESTO_STATUS_LABEL[status]}
  </span>
);
