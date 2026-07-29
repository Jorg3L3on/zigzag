/**
 * Estado de cobro del ticket según total y monto pagado.
 */
export type TicketPaymentStatus = 'paid' | 'partial' | 'pending';

export const AMOUNT_TOLERANCE = 0.01;

/** Saldo pendiente en moneda (0 si ya está cubierto dentro de la tolerancia). */
export const getTicketBalanceDue = (
  total: number | null | undefined,
  paid: number | null | undefined,
): number => {
  const totalAmount = total ?? 0;
  const paidAmount = paid ?? 0;
  const raw = totalAmount - paidAmount;
  if (raw <= AMOUNT_TOLERANCE) {
    return 0;
  }
  return Math.max(0, raw);
};

export const getTicketPaymentStatus = (
  total: number | null | undefined,
  paid: number | null | undefined,
): TicketPaymentStatus => {
  const paidAmount = paid ?? 0;
  const totalAmount = total ?? 0;

  if (totalAmount <= AMOUNT_TOLERANCE) {
    return 'pending';
  }

  if (paidAmount >= totalAmount - AMOUNT_TOLERANCE) {
    return 'paid';
  }

  if (paidAmount > AMOUNT_TOLERANCE) {
    return 'partial';
  }

  return 'pending';
};

/** Para ordenar columnas: menor = más “pagado”. */
export const getTicketPaymentStatusSortRank = (
  total: number | null | undefined,
  paid: number | null | undefined,
): number => {
  const status = getTicketPaymentStatus(total, paid);
  if (status === 'paid') return 0;
  if (status === 'partial') return 1;
  return 2;
};

/** Ratio pagado/total clamped to [0, 1] for progress UI. */
export const getTicketPaymentProgressRatio = (
  total: number | null | undefined,
  paid: number | null | undefined,
): number => {
  const totalAmount = total ?? 0;
  if (totalAmount <= 0) return 0;
  const paidAmount = Math.max(0, paid ?? 0);
  return Math.min(1, Math.max(0, paidAmount / totalAmount));
};

/**
 * Compact money for dense list cells: whole pesos when the amount has no cents,
 * otherwise two decimals (es-MX grouping).
 */
export const formatTicketListAmount = (
  amount: number | null | undefined,
): string => {
  if (amount == null) return 'Sin total';
  const hasCents = Math.abs(amount - Math.round(amount)) >= AMOUNT_TOLERANCE;
  return `$${amount.toLocaleString('es-MX', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
};

/** Etiquetas cortas para UI */
export const TICKET_PAYMENT_STATUS_LABEL: Record<TicketPaymentStatus, string> =
  {
    paid: 'Saldado',
    partial: 'Pago parcial',
    pending: 'Pendiente',
  };

/** Shared accent colors for payment status indicators (dot / bar). */
export const TICKET_PAYMENT_STATUS_ACCENT_CLASS: Record<
  TicketPaymentStatus,
  string
> = {
  paid: 'bg-emerald-500 dark:bg-emerald-400',
  partial: 'bg-amber-500 dark:bg-amber-400',
  pending: 'bg-slate-500 dark:bg-slate-400',
};
