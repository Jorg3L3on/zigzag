/**
 * Destino al pulsar la fila del listado de tickets.
 * Finalizado (incl. pago parcial) → detalle; borrador → edición.
 */
export const hrefForTicketListRow = (ticket: {
  id: bigint;
  finished: boolean;
}, canWrite = true): string => {
  const id = ticket.id.toString();
  return ticket.finished || !canWrite
    ? `/dashboard/tickets/${id}`
    : `/dashboard/tickets/${id}/edit`;
};
