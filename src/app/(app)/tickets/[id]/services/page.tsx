import { redirect } from 'next/navigation';

/**
 * Ticket lines are edited in the composer, like presupuestos (ZIG-I13-6). The
 * route stays for old links and bookmarks.
 */
export default async function TicketServicesRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/tickets/${encodeURIComponent(id)}/edit`);
}
