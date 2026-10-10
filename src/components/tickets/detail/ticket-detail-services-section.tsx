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
import { getServiceLineName } from '@/lib/service-line-display';
import { ReviewLineMaterials } from '@/components/tickets/review/document-review-parts';
import { buildReviewLine } from '@/lib/review-lines';
import { lineTotalWithMaterials } from '@/lib/money';

type ServiceLine = {
  id: number;
  quantity: number;
  price: number;
  service_id?: number | null;
  name?: string | null;
  service: { name: string | null } | null;
  /** Active materials (ZIG-I10). */
  materials?: Array<{
    id: number;
    material_id: number | null;
    name: string | null;
    unit: string | null;
    quantity: number | string;
    price: number | string;
  }>;
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
        count={services.length}
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
                <div className="flex flex-col gap-2 p-3.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6">
                  <div className="min-w-0 space-y-0.5 sm:col-start-1 sm:row-start-1">
                    <p className="font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
                      {getServiceLineName(line)}
                    </p>
                    <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      <span className="tabular-nums">{line.quantity}</span>
                      {' × '}
                      <FormattedCurrency amount={line.price} />
                      {' / unidad'}
                    </p>
                  </div>
                  <div className="order-2 min-w-0 empty:hidden sm:order-none sm:col-span-2 sm:row-start-2">
                    <ReviewLineMaterials
                      materials={buildReviewLine(line).materials}
                      showInlineChips
                    />
                  </div>
                  <p className="order-3 text-base font-semibold tabular-nums text-foreground [overflow-wrap:anywhere] sm:order-none sm:col-start-2 sm:row-start-1 sm:text-right">
                    <FormattedCurrency
                      amount={lineTotalWithMaterials({
                        quantity: line.quantity,
                        price: Number(line.price),
                        materials: line.materials,
                      })}
                    />
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-4 border-t border-border/60 bg-muted/30 px-3.5 py-3.5">
            <p className="text-sm font-medium text-muted-foreground">Total</p>
            <p className="text-right text-lg font-semibold tabular-nums tracking-tight [overflow-wrap:anywhere]">
              <FormattedCurrency amount={total} />
            </p>
          </div>
        </div>
      )}
    </TicketDetailSectionCard>
  );
};
