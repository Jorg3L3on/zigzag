export const buildTicketInvoiceDownloadUrl = (
  ticketId: string | number | bigint,
  companyId?: number | null,
): string => {
  const params = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
  return `/api/tickets/${String(ticketId)}/invoice${params}`;
};
