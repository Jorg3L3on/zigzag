'use client';

import * as React from 'react';
import Link from 'next/link';
import { Receipt } from 'lucide-react';

import {
  DocumentSummaryRows,
  type DocumentSummaryLine,
} from '@/components/documents/document-summary-rows';
import { Button } from '@/components/ui/button';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { TripledEmptyState } from '@/components/tripled';
import { usePermissions } from '@/hooks/use-permissions';
import { materialDraftAmount } from '@/lib/material-drafts';
import { isTicketFullyPaid } from '@/lib/ticket-payment-status';
import { buildReviewLine, reviewLineAmount } from '@/lib/review-lines';
import { canAssignTicketServices } from '@/lib/tickets-rbac';

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
  total: number | null;
  paid: number | null;
  services: ServiceLine[];
};

/** `Ver detalle con N materiales`: the detail's name for the summary toggle. */
const detailToggleLabel = (_services: number, materials: number) =>
  materials === 0
    ? 'Ver detalle'
    : materials === 1
      ? 'Ver detalle con 1 material'
      : `Ver detalle con ${materials} materiales`;

/**
 * Servicios as a compact summary (ZIG-I13-4): three recibo-style rows, Editar
 * (the one editor, phase 6) and "Ver detalle con N materiales". A settled
 * ticket cannot be edited.
 */
export const TicketDetailServicesSection = ({
  ticketId,
  total,
  paid,
  services,
}: TicketDetailServicesSectionProps) => {
  const { can } = usePermissions();
  const canManage = canAssignTicketServices(can) && !isTicketFullyPaid(total, paid);
  const id = Number(ticketId);

  const rows = React.useMemo<DocumentSummaryLine[]>(
    () =>
      services.map((line) => {
        const review = buildReviewLine(line);
        return {
          id: review.id,
          name: review.name,
          quantity: review.quantity,
          amount: reviewLineAmount(review),
          materials: (review.materials ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            amount: materialDraftAmount(item),
          })),
        };
      }),
    [services],
  );

  return (
    <TicketDetailSectionCard aria-labelledby="ticket-services-heading">
      <TicketDetailSectionHeading
        id="ticket-services-heading"
        title="Servicios"
        count={services.length}
        action={
          canManage && services.length > 0 ? (
            <Link
              href={`/tickets/${id}/services`}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
              aria-label="Editar servicios"
            >
              Editar
            </Link>
          ) : null
        }
      />

      {services.length === 0 ? (
        <TripledEmptyState
          icon={<Receipt className="h-4 w-4" />}
          title="Sin servicios"
          description="Este ticket aún no tiene líneas de servicio."
          action={
            canManage ? (
              <Button asChild size="sm">
                <Link href={`/tickets/${id}/services`}>Agregar servicio</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <DocumentSummaryRows lines={rows} label="Servicios del ticket" toggleLabel={detailToggleLabel} />
      )}
    </TicketDetailSectionCard>
  );
};
