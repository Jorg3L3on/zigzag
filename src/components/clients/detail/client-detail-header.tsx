import Link from 'next/link';
import { ClipboardList, MessageCircle, Pencil, Ticket } from 'lucide-react';

import type { Client } from '@/actions/clients';
import { ClientPhoneLink } from '@/components/client-phone-link';
import { Button } from '@/components/ui/button';
import { formatClientAddressOneLine } from '@/lib/client-address';
import { formatPhoneDisplay } from '@/lib/phone-links';
import { buildWhatsAppHref } from '@/lib/whatsapp-share';

// Two columns at 333px leave too little room for "Nuevo presupuesto" on one
// line, so the label may wrap; the button grows instead of overflowing.
const ACTION_BUTTON_CLASS =
  'h-auto min-h-11 gap-2 whitespace-normal rounded-xl py-2 text-center leading-tight';

type ClientDetailHeaderProps = {
  client: Client;
  canWriteClients: boolean;
  canWriteTickets: boolean;
};

const Detail = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </dt>
    <dd className="mt-0.5 text-base [overflow-wrap:anywhere]">{children}</dd>
  </div>
);

/**
 * Name, contact data and the actions for one client (ZIG-I17-1). Editar, Nuevo
 * ticket and Nuevo presupuesto only show for people who can write them.
 */
export const ClientDetailHeader = ({
  client,
  canWriteClients,
  canWriteTickets,
}: ClientDetailHeaderProps) => {
  const address = formatClientAddressOneLine(client);
  const phone = formatPhoneDisplay(client.phone);
  const whatsapp = buildWhatsAppHref({
    phone: client.phone,
    message: `Hola ${client.name.trim()}, te escribimos desde tu proveedor de servicio.`,
  });

  return (
    <section
      aria-label="Datos del cliente"
      className="space-y-4"
      data-testid="client-detail-header"
    >
      <h1
        className="text-2xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere] md:text-3xl"
        data-testid="client-detail-title"
      >
        {client.name}
      </h1>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label="Teléfono">
          <ClientPhoneLink
            phone={client.phone}
            className="underline-offset-4 hover:underline"
          >
            {phone}
          </ClientPhoneLink>
        </Detail>
        <Detail label="Correo">{client.email?.trim() || '—'}</Detail>
        <Detail label="Dirección">{address || '—'}</Detail>
        <Detail label="Documento">{client.document?.trim() || '—'}</Detail>
      </dl>

      <div
        className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
        data-testid="client-detail-actions"
      >
        {canWriteTickets ? (
          <>
            <Button asChild variant="outline" className={ACTION_BUTTON_CLASS}>
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
