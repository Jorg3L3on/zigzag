/**
 * Destino al pulsar la fila del listado de tickets.
 * Workbench: detail owns finish/collect; edit is for soft field edits only.
 */
export const hrefForTicketListRow = (ticket: {
  id: bigint;
  finished: boolean;
}, canWrite = true): string => {
  const id = ticket.id.toString();
  // Read-only users and all operators land on detail workbench.
  void canWrite;
  return `/tickets/${id}`;
};
