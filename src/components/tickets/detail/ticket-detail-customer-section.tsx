import Link from 'next/link';
import { Mail, Phone, IdCard } from 'lucide-react';
import { ClientPhoneLink } from '@/components/client-phone-link';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';

type TicketDetailCustomerSectionProps = {
  clientId: number | null;
  clientTel: string | null;
  email: string | null;
  document: string | null;
};

export const TicketDetailCustomerSection = ({
  clientId,
  clientTel,
  email,
  document,
}: TicketDetailCustomerSectionProps) => {
  const phone = clientTel?.trim() || null;
  const mail = email?.trim() || null;
  const doc = document?.trim() || null;

  return (
    <TicketDetailSectionCard aria-labelledby="ticket-customer-heading">
      <TicketDetailSectionHeading
        id="ticket-customer-heading"
        title="Contacto"
        action={
          clientId ? (
            <Link
              href={`/clients/${clientId}/edit`}
              className="text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ver cliente
            </Link>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
        {phone ? (
          <ClientPhoneLink
            phone={phone}
            className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            textClassName="inline-flex min-w-0 max-w-full items-center gap-2 text-sm font-medium text-foreground"
          >
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate tabular-nums">{phone}</span>
          </ClientPhoneLink>
        ) : (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" aria-hidden />
            Sin teléfono
          </p>
        )}

        {mail ? (
          <a
            href={`mailto:${mail}`}
            className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Enviar correo a ${mail}`}
          >
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate break-all">{mail}</span>
          </a>
        ) : (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            Sin correo
          </p>
        )}

        {doc ? (
          <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <IdCard className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="tabular-nums">{doc}</span>
          </p>
        ) : null}
      </div>
    </TicketDetailSectionCard>
  );
};
