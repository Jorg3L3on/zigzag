export const buildTicketInvoiceDownloadUrl = (
  ticketId: string | number | bigint,
  companyId?: number | null,
): string => {
  const params = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
  return `/api/tickets/${String(ticketId)}/invoice${params}`;
};

/** Same PDF served with `Content-Disposition: inline` for in-page previews. */
export const buildTicketInvoicePreviewUrl = (
  ticketId: string | number | bigint,
  companyId?: number | null,
): string => {
  const params = new URLSearchParams({ disposition: 'inline' });
  if (companyId) params.set('company_id', String(companyId));
  return `/api/tickets/${String(ticketId)}/invoice?${params.toString()}`;
};
