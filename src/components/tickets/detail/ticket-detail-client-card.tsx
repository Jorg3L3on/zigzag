import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  TicketDetailRailLabel,
  TicketDetailSectionCard,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { formatPhoneDisplay } from '@/lib/phone-links';
import { buildWhatsAppHref, buildWhatsAppReceiptShare } from '@/lib/whatsapp-share';

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
  created_at?: Date | string | null;
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
  /** En proceso has no recibo yet: WhatsApp opens a plain greeting instead. */
  finished?: boolean;
  /** Signs the WhatsApp text like the header does (PR #610 review). */
  companyName?: string | null;
  /** The client's other finished tickets that still owe something. */
  openBalances?: Array<{ id: string; folio: string; balance: number }>;
};

/**
 * «2 tickets · R-0060 con saldo $421,582.39», or «· cliente desde octubre de
 * 2026» when nothing else is owed (canvas).
 */
export const describeClientDocuments = ({
  ticketCount,
  openBalances = [],
  clientSince = null,
}: {
  ticketCount: number | null;
  openBalances?: Array<{ folio: string; balance: number }>;
  clientSince?: Date | string | null;
}): string | null => {
  const parts: string[] = [];
  if (ticketCount != null) parts.push(`${ticketCount} ${ticketCount === 1 ? 'ticket' : 'tickets'}`);
  if (openBalances.length === 1) {
    parts.push(`${openBalances[0].folio} con saldo ${formatServiceCurrency(openBalances[0].balance)}`);
  } else if (openBalances.length > 1) {
    const sum = openBalances.reduce((total, row) => total + row.balance, 0);
    parts.push(`${openBalances.length} con saldo ${formatServiceCurrency(sum)}`);
  } else if (clientSince) {
    const since = new Date(clientSince);
    if (!Number.isNaN(since.getTime())) {
      parts.push(`cliente desde ${format(since, "MMMM 'de' yyyy", { locale: es })}`);
    }
  }
  return parts.length ? parts.join(' · ') : null;
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
  finished = true,
  companyName = null,
  openBalances = [],
}: TicketDetailClientCardProps) => {
  const name = client?.name?.trim() || clientName?.trim() || 'Cliente sin nombre';
  const phone = client?.phone?.trim() || clientTel?.trim() || '';
  const email = client?.email?.trim() || clientEmail?.trim() || '';
  const address = formatTicketClientAddress(client);
  const company = companyName?.trim() || null;
  const whatsApp = !phone
    ? null
    : finished && total != null
      ? buildWhatsAppReceiptShare({
          phone,
          clientName: name,
          ticketId,
          folio,
          total,
          paid: paid ?? 0,
          companyName: company,
        })
      : buildWhatsAppHref({
          phone,
          message: company ? `Hola, te escribe ${company}.` : 'Hola, te escribimos de ZigZag.',
        });

  const documents = describeClientDocuments({
    ticketCount,
    openBalances,
    clientSince: client?.created_at ?? null,
  });
  const phoneText = formatPhoneDisplay(phone) ?? phone;

  return (
    <TicketDetailSectionCard aria-labelledby="ticket-client-heading" data-testid="ticket-client-card">
      <TicketDetailRailLabel id="ticket-client-heading">Cliente</TicketDetailRailLabel>
      <div className="mt-3 flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-100 text-caption lg:text-[13px]/[inherit] font-bold text-blue-800 dark:bg-blue-500/20 dark:text-blue-200"
        >
          {clientInitials(name)}
        </span>
        <div className="min-w-0">
          {client ? (
            <Link
              href={`/clients/${client.id}`}
              className="block font-semibold leading-snug text-foreground underline-offset-4 [overflow-wrap:anywhere] hover:underline"
            >
              {name}
            </Link>
          ) : (
            <p className="font-semibold leading-snug [overflow-wrap:anywhere]">{name}</p>
          )}
          {documents ? (
            <p className="mt-0.5 text-caption text-muted-foreground" data-testid="ticket-client-documents">
              {documents}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 flex flex-col gap-2.5 text-sm">
        {phone ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Teléfono</dt>
            <dd className="flex items-center gap-2">
              <span className="font-medium tabular-nums" data-testid="ticket-client-phone">
                {phoneText}
              </span>
              {whatsApp ? (
                <Button asChild variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-lg">
                  <a
                    href={whatsApp.href}
                    aria-label="Escribir por WhatsApp"
                    data-testid="ticket-client-whatsapp"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                  </a>
                </Button>
              ) : null}
            </dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Dirección</dt>
          <dd className="min-w-0 text-right [overflow-wrap:anywhere]">
            {address ? (
              address
            ) : (
              <>
                <span className="text-muted-foreground">Sin dirección</span>
                {client ? (
                  <>
                    {' · '}
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Agregar
                    </Link>
                  </>
                ) : null}
              </>
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Correo</dt>
          <dd className={email ? 'min-w-0 text-right [overflow-wrap:anywhere]' : 'text-muted-foreground'}>
            {email || '—'}
          </dd>
        </div>
      </dl>

      {client ? (
        <Link
          href={`/clients/${client.id}`}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver cliente
        </Link>
      ) : null}
    </TicketDetailSectionCard>
  );
};
