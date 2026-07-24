'use client';

import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormattedCurrency } from '@/components/formatted-currency';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { TripledEmptyState } from '@/components/tripled';
import { usePermissions } from '@/hooks/use-permissions';
import { canAssignTicketServices } from '@/lib/tickets-rbac';

type ServiceLine = {
  id: number;
  quantity: number;
  price: number;
  service: { name: string | null } | null;
};

type TicketDetailServicesSectionProps = {
  ticketId: number | bigint;
  finished: boolean;
  total: number | null;
  services: ServiceLine[];
};

export const TicketDetailServicesSection = ({
  ticketId,
  finished,
  total,
  services,
}: TicketDetailServicesSectionProps) => {
  const { can } = usePermissions();
  const canManage = canAssignTicketServices(can);
  const id = Number(ticketId);

  return (
    <TicketDetailSectionCard aria-labelledby="ticket-services-heading">
      <TicketDetailSectionHeading
        id="ticket-services-heading"
        title="Servicios"
        description="Líneas de servicio registradas en este ticket"
        action={
          canManage ? (
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
              <Link
                href={`/tickets/${id}/services`}
                aria-label="Administrar servicios"
              >
                <Receipt className="h-3.5 w-3.5" aria-hidden />
                {finished ? 'Ver servicios' : 'Administrar'}
              </Link>
            </Button>
          ) : null
        }
      />

      {services.length === 0 ? (
        <TripledEmptyState
          icon={<Receipt className="h-4 w-4" />}
          title="Sin servicios"
          description="Este ticket aún no tiene líneas de servicio."
          action={
            canManage && !finished ? (
              <Button asChild size="sm">
                <Link href={`/tickets/${id}/services`}>Agregar servicio</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <ul className="divide-y divide-border/60">
            {services.map((line) => (
              <li key={line.id}>
                <div className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium leading-snug text-foreground">
                      {line.service?.name ?? 'Servicio'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="tabular-nums">{line.quantity}</span>
                      {' × '}
                      <FormattedCurrency amount={line.price} />
                      {' / unidad'}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-semibold tabular-nums text-foreground">
                    <FormattedCurrency amount={line.price * line.quantity} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-4 border-t border-border/60 bg-muted/30 px-3.5 py-3.5">
            <p className="text-sm font-medium text-muted-foreground">Total</p>
            <p className="text-lg font-semibold tabular-nums tracking-tight">
              <FormattedCurrency amount={total} />
            </p>
          </div>
        </div>
      )}
    </TicketDetailSectionCard>
  );
};
