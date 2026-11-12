import { redirect } from 'next/navigation';

import { requirePagePermission } from '@/lib/page-authz';

/**
 * The creation review is gone (ZIG-I24-4): Nuevo ticket finishes the ticket
 * itself and lands on the detail. Old links and bookmarks go there too.
 */
export default async function TicketReadyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission('tickets.read');
  const { id } = await params;
  redirect(`/tickets/${encodeURIComponent(id)}`);
}
