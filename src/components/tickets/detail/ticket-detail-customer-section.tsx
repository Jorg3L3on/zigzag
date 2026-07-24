import Link from 'next/link';
import { Mail, Phone, IdCard } from 'lucide-react';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';

type TicketDetailCustomerSectionProps = {
  clientId: number | null;
  clientName: string | null;
  clientTel: string | null;
  email: string | null;
  document: string | null;
};

export const TicketDetailCustomerSection = ({
  clientId,
  clientName,
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
        title="Cliente"
        description="Resumen de contacto del ticket"
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

      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Nombre
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {clientName || 'No especificado'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Teléfono
            </p>
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="mt-1 inline-flex min-w-0 max-w-full items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Llamar a ${phone}`}
              >
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate tabular-nums">{phone}</span>
              </a>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No especificado</p>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Correo
            </p>
            {mail ? (
              <a
                href={`mailto:${mail}`}
                className="mt-1 inline-flex min-w-0 max-w-full items-start gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Enviar correo a ${mail}`}
              >
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="break-all">{mail}</span>
              </a>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No especificado</p>
            )}
          </div>
        </div>

        {doc ? (
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Documento
            </p>
            <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <IdCard className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="tabular-nums">{doc}</span>
            </p>
          </div>
        ) : null}
      </div>
    </TicketDetailSectionCard>
  );
};
