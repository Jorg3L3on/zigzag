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

/** Etiquetas cortas para UI */
export const TICKET_PAYMENT_STATUS_LABEL: Record<TicketPaymentStatus, string> =
  {
    paid: 'Saldado',
    partial: 'Pago parcial',
    pending: 'Pendiente',
  };
