'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

import { DocumentLineRow } from '@/components/documents/document-line-row';
import { DocumentLinesDensitySwitch } from '@/components/documents/document-lines-density-switch';
import type { DocumentSummaryLine } from '@/components/documents/document-summary-rows';
import { MoneyFigure } from '@/components/documents/money-figure';
import {
  TicketDetailSectionCard,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { sumLineTotals, sumMaterialTotals } from '@/lib/money';
import { getTicketBalanceDue, getTicketPaymentStatus } from '@/lib/ticket-payment-status';

const RECEIPT_COLUMNS = 'grid-cols-[minmax(0,1fr)_72px_120px_130px]';

type TicketDetailDocumentProps = {
  ticketId: number;
  lines: ReadonlyArray<DocumentSummaryLine>;
  total: number | null;
  paid: number | null;
  finished: boolean;
  workNotes: string | null;
  canManage: boolean;
};

const countLabel = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * The ticket as a receipt, from 1024px (ZIG-I28-2). The phone summary stays
 * in TicketDetailServicesSection.
 */
export const TicketDetailDocument = ({
  ticketId,
  lines,
  total,
  paid,
  finished,
  workNotes,
  canManage,
}: TicketDetailDocumentProps) => {
  const materialCount = lines.reduce((sum, line) => sum + (line.materials?.length ?? 0), 0);
  const servicesTotal = sumLineTotals(
    lines.map((line) => ({ quantity: line.quantity, price: line.price ?? 0 })),
  );
  const materialsTotal = sumMaterialTotals(
    lines.flatMap((line) => line.materials ?? []),
  );
  const hasMaterials = materialCount > 0;
  const paidFully = finished && getTicketPaymentStatus(total, paid) === 'paid';
  const balance = getTicketBalanceDue(total, paid);
  const notes = workNotes?.trim() ?? '';

  return (
    <TicketDetailSectionCard aria-labelledby="ticket-document-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="ticket-document-heading" className="text-[15px] font-semibold">
          Servicios y materiales
          <span className="font-normal text-muted-foreground">
            {' · '}
            {countLabel(lines.length, 'servicio', 'servicios')}
            {hasMaterials ? ` · ${countLabel(materialCount, 'material', 'materiales')}` : ''}
          </span>
        </h2>
        <div className="flex items-center gap-3">
          <DocumentLinesDensitySwitch />
          {/* A finished ticket edits from the header (Editar); En proceso adds work here (canvas). */}
          {canManage && !finished ? (
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link href={`/tickets/${ticketId}/edit`}>Agregar servicio</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className={`mb-1 grid items-baseline gap-x-2 text-caption font-medium text-muted-foreground ${RECEIPT_COLUMNS}`}
      >
        <span>Concepto</span>
        <span className="text-right">Cant.</span>
        <span className="text-right">P. unitario</span>
        <span className="text-right">Importe</span>
      </div>

      <ul aria-label="Servicios del ticket" className="divide-y divide-border/60">
        {lines.map((line, index) => (
          <li key={line.id}>
            <DocumentLineRow
              layout="receipt"
              index={index + 1}
              name={line.name}
              description={line.description}
              serviceId={line.serviceId}
              quantity={line.quantity}
              price={line.price ?? 0}
              amount={line.amount}
              materials={line.materials}
            />
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-end" data-testid="ticket-document-totals">
        <dl className="w-full max-w-[360px] space-y-1.5 rounded-xl bg-muted/40 px-4 py-3 text-sm">
          {hasMaterials ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Servicios</dt>
                <dd>
                  <MoneyFigure amount={servicesTotal} size="sm" />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Materiales</dt>
                <dd>
                  <MoneyFigure amount={materialsTotal} size="sm" />
                </dd>
              </div>
            </>
          ) : null}
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Total</dt>
            <dd>
              <MoneyFigure amount={total ?? 0} size="sm" />
            </dd>
          </div>
          {finished ? (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Pagado</dt>
              <dd>
                <MoneyFigure amount={paid ?? 0} size="sm" />
              </dd>
            </div>
          ) : null}
          {finished && !paidFully ? (
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
              <dt className="text-[15px] font-semibold">Saldo por pagar</dt>
              <dd>
                <MoneyFigure amount={balance} size="lg" data-testid="ticket-document-balance" />
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <section className="mt-5" aria-labelledby="ticket-work-notes-heading">
        <h3 id="ticket-work-notes-heading" className="text-[15px] font-semibold">
          Notas del trabajo
        </h3>
        {notes ? (
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]" data-testid="ticket-work-notes">
            {notes}
          </p>
        ) : finished ? (
          <p className="mt-1 text-sm text-muted-foreground">Sin notas</p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Sin notas todavía
            {canManage ? (
              <>
                {' · '}
                <Link
                  href={`/tickets/${ticketId}/edit`}
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Agregar notas
                </Link>
              </>
            ) : null}
          </p>
        )}
      </section>
    </TicketDetailSectionCard>
  );
};
