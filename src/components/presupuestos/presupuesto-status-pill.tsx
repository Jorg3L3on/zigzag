import { PRESUPUESTO_STATUS_LABEL, type PresupuestoStatus } from '@/lib/ticket-document-kind';
import { cn } from '@/lib/utils';

const STATUS_PILL_CLASS: Record<PresupuestoStatus, string> = {
  abierto: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  vencido: 'bg-red-500/15 text-red-700 dark:text-red-300',
  convertido: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  cancelado: 'bg-slate-500/10 text-muted-foreground',
};

/** Desktop shows Aceptado in green, the good outcome (ZIG-I29-1); the phone keeps grey. */
const DESKTOP_PILL_CLASS: Record<PresupuestoStatus, string> = {
  ...STATUS_PILL_CLASS,
  convertido: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

export const PresupuestoStatusPill = ({
  status,
  className,
  surface = 'phone',
}: {
  status: PresupuestoStatus;
  className?: string;
  surface?: 'phone' | 'desktop';
}) => (
  <span
    data-testid="presupuesto-status"
    className={cn(
      'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-caption font-semibold',
      (surface === 'desktop' ? DESKTOP_PILL_CLASS : STATUS_PILL_CLASS)[status],
      className,
    )}
  >
    {PRESUPUESTO_STATUS_LABEL[status]}
  </span>
);
