import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClipboardList, MessageCircle, Pencil, Ticket } from 'lucide-react';

import type { Client } from '@/actions/clients';
import { Button } from '@/components/ui/button';
import { formatClientAddressOneLine } from '@/lib/client-address';
import { formatPhoneDisplay } from '@/lib/phone-links';
import { cn } from '@/lib/utils';
import { buildWhatsAppHref } from '@/lib/whatsapp-share';

// Two columns at 333px leave too little room for "Nuevo presupuesto" on one
// line, so the label may wrap; the button grows instead of overflowing.
// From lg the buttons are the 40 px header buttons of the ticket detail.
const ACTION_BUTTON_CLASS =
  'h-auto min-h-11 gap-2 whitespace-normal rounded-xl py-2 text-center leading-tight lg:h-10 lg:min-h-0 lg:whitespace-nowrap lg:py-0';

/** Nuevo ticket is the primary action on desktop; the phone keeps four equal buttons. */
const PRIMARY_DESKTOP_CLASS =
  'lg:border-transparent lg:bg-primary lg:font-semibold lg:text-primary-foreground lg:hover:bg-primary/90 lg:hover:text-primary-foreground';

/** The small uppercase label that heads each card of the desktop column (ticket detail rail). */
export const CLIENT_RAIL_LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground';

/** A card of the desktop column; below lg the content sits on the page card as before. */
export const CLIENT_RAIL_CARD_CLASS =
  'lg:rounded-xl lg:border lg:border-border/50 lg:bg-card lg:p-5';

type ClientDetailHeaderProps = {
  client: Client;
  canWriteClients: boolean;
  canWriteTickets: boolean;
  /** Work tickets and presupuestos, for the desktop summary line. */
  ticketCount?: number;
  presupuestoCount?: number;
  /** Date of the newest work ticket. */
  lastTicketDate?: string | null;
  /** Grid placement from the page, per part (the section is `display: contents` there). */
  titleClassName?: string;
  detailsClassName?: string;
  actionsClassName?: string;
  className?: string;
};

const Detail = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </dt>
    <dd className="mt-0.5 text-base [overflow-wrap:anywhere]">{children}</dd>
  </div>
);

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Name, contact data and the actions for one client (ZIG-I17-1). Editar, Nuevo
 * ticket and Nuevo presupuesto only show for people who can write them. From lg
 * the title reads like the ticket detail and the data moves to a card of its own.
 */
export const ClientDetailHeader = ({
  client,
  canWriteClients,
  canWriteTickets,
  ticketCount,
  presupuestoCount,
  lastTicketDate = null,
  titleClassName,
  detailsClassName,
  actionsClassName,
  className,
}: ClientDetailHeaderProps) => {
  const address = formatClientAddressOneLine(client);
  const phone = formatPhoneDisplay(client.phone);
  const whatsapp = buildWhatsAppHref({
    phone: client.phone,
    message: `Hola ${client.name.trim()}, te escribimos desde tu proveedor de servicio.`,
  });
  const since = client.created_at
    ? format(new Date(client.created_at), "MMMM 'de' yyyy", { locale: es })
    : null;
  const summary = [
    ticketCount != null ? plural(ticketCount, 'ticket', 'tickets') : null,
    presupuestoCount != null ? plural(presupuestoCount, 'presupuesto', 'presupuestos') : null,
    lastTicketDate
      ? `último trabajo el ${format(new Date(lastTicketDate), "d 'de' MMMM 'de' yyyy", { locale: es })}`
      : null,
  ].filter(Boolean);

  return (
    <section
      aria-label="Datos del cliente"
      className={cn('space-y-4', className)}
      data-testid="client-detail-header"
    >
      <div className={cn('min-w-0 lg:space-y-1', titleClassName)}>
        {since ? (
          <p className="hidden text-sm font-medium text-muted-foreground lg:block">
            Cliente desde {since}
          </p>
        ) : null}
        <h1
          className="text-2xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere] md:text-3xl lg:font-semibold"
          data-testid="client-detail-title"
        >
          {client.name}
        </h1>
        {summary.length > 0 ? (
          <p className="hidden text-sm text-muted-foreground lg:block">{summary.join(' · ')}</p>
        ) : null}
      </div>

      <div className={cn('min-w-0', CLIENT_RAIL_CARD_CLASS, detailsClassName)}>
        <h2 className={cn(CLIENT_RAIL_LABEL_CLASS, 'hidden lg:mb-3 lg:block')}>Datos</h2>
        <dl className="grid gap-3 sm:grid-cols-2 @min-[60rem]:grid-cols-1">
          <Detail label="Teléfono">
            {phone}
          </Detail>
          <Detail label="Correo">{client.email?.trim() || '—'}</Detail>
          <Detail label="Dirección">{address || '—'}</Detail>
          <Detail label="Documento">{client.document?.trim() || '—'}</Detail>
        </dl>
      </div>

      <div
        className={cn('grid grid-cols-2 gap-2 sm:flex sm:flex-wrap', actionsClassName)}
        data-testid="client-detail-actions"
      >
        {canWriteTickets ? (
          <>
            <Button asChild variant="outline" className={cn(ACTION_BUTTON_CLASS, PRIMARY_DESKTOP_CLASS)}>
              <Link href={`/tickets/create?clientId=${client.id}`}>
                <Ticket className="h-4 w-4" aria-hidden />
                Nuevo ticket
              </Link>
            </Button>
            <Button asChild variant="outline" className={ACTION_BUTTON_CLASS}>
              <Link href={`/presupuestos/create?clientId=${client.id}`}>
                <ClipboardList className="h-4 w-4" aria-hidden />
                Nuevo presupuesto
              </Link>
            </Button>
          </>
        ) : null}
        {whatsapp ? (
          <Button asChild variant="outline" className={ACTION_BUTTON_CLASS}>
            <a href={whatsapp.href} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" aria-hidden />
              WhatsApp
            </a>
          </Button>
        ) : null}
        {canWriteClients ? (
          <Button asChild variant="outline" className={ACTION_BUTTON_CLASS}>
            <Link href={`/clients/${client.id}/edit`}>
              <Pencil className="h-4 w-4" aria-hidden />
              Editar
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
};
