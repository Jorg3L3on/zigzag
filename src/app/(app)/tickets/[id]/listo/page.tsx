import { redirect } from 'next/navigation';

/**
 * The creation review is gone (ZIG-I24-4): Nuevo ticket finishes the ticket
 * itself and lands on the detail. Old links and bookmarks go there too.
 */
export default async function TicketReadyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/tickets/${encodeURIComponent(id)}`);
}
