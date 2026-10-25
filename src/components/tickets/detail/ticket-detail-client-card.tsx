import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { buildWhatsAppReceiptShare } from '@/lib/whatsapp-share';

const clientInitials = (name: string | null | undefined): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
};

const formatTicketClientAddress = (
  client: TicketClientCardSource | null,
): string | null => {
  if (!client) return null;
  const direct = client.address?.trim();
  if (direct) return direct;
  const street = [client.street?.trim(), client.exterior_number?.trim()].filter(Boolean).join(' ');
  const place = [client.neighborhood?.trim(), client.city?.trim()].filter(Boolean).join(', ');
  const line = [street, place].filter(Boolean).join(', ');
  return line || null;
};

type TicketClientCardSource = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  street?: string | null;
  exterior_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
};

type TicketDetailClientCardProps = {
  client: TicketClientCardSource | null;
  clientName: string | null;
  clientTel: string | null;
  clientEmail: string | null;
  ticketCount: number | null;
  ticketId: number;
  folio: string | null;
  total: number | null;
  paid: number | null;
};

/** Cliente column from 1024px. The phone is text; WhatsApp stays (ZIG-I28-2). */
export const TicketDetailClientCard = ({
  client,
  clientName,
  clientTel,
  clientEmail,
  ticketCount,
  ticketId,
  folio,
  total,
  paid,
}: TicketDetailClientCardProps) => {
  const name = client?.name?.trim() || clientName?.trim() || 'Cliente sin nombre';
  const phone = client?.phone?.trim() || clientTel?.trim() || '';
  const email = client?.email?.trim() || clientEmail?.trim() || '';
  const address = formatTicketClientAddress(client);
  const whatsApp =
    phone && total != null
      ? buildWhatsAppReceiptShare({
          phone,
          clientName: name,
          ticketId,
          folio,
          total,
          paid: paid ?? 0,
        })
      : null;

  return (
    <TicketDetailSectionCard aria-labelledby="ticket-client-heading" data-testid="ticket-client-card">
      <TicketDetailSectionHeading id="ticket-client-heading" title="Cliente" />
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
        >
          {clientInitials(name)}
        </span>
        <div className="min-w-0">
          {client ? (
            <Link
              href={`/clients/${client.id}`}
              className="block font-medium text-foreground underline-offset-4 [overflow-wrap:anywhere] hover:underline"
            >
              {name}
            </Link>
          ) : (
            <p className="font-medium [overflow-wrap:anywhere]">{name}</p>
          )}
          {ticketCount != null ? (
            <p className="text-caption text-muted-foreground">
              {ticketCount} {ticketCount === 1 ? 'ticket' : 'tickets'}
            </p>
          ) : null}
        </div>
      </div>

      {phone ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption text-muted-foreground">Teléfono</p>
            <p className="text-sm tabular-nums" data-testid="ticket-client-phone">
              {phone}
            </p>
          </div>
          {whatsApp ? (
            <Button asChild variant="outline" size="icon" className="shrink-0">
              <a href={whatsApp.href} aria-label="WhatsApp" data-testid="ticket-client-whatsapp">
                <MessageCircle className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      {client ? (
        <div className="mt-3">
          <p className="text-caption text-muted-foreground">Dirección</p>
          {address ? (
            <p className="text-sm [overflow-wrap:anywhere]">{address}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin dirección ·{' '}
              <Link href={`/clients/${client.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                Agregar
              </Link>
            </p>
          )}
        </div>
      ) : null}

      {email ? (
        <div className="mt-3">
          <p className="text-caption text-muted-foreground">Correo</p>
          <p className="text-sm [overflow-wrap:anywhere]">{email}</p>
        </div>
      ) : null}

      {client ? (
        <Link
          href={`/clients/${client.id}`}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Ver cliente
        </Link>
      ) : null}
    </TicketDetailSectionCard>
  );
};
