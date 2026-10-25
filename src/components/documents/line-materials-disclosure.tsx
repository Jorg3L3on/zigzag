'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { formatMaterialQuantity, materialDraftAmount, materialDraftsTotal } from '@/lib/material-drafts';
import { roundMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export type LineMaterialDetail = {
  id: number | string;
  name: string;
  quantity: number;
  unit?: string | null;
  price: number;
  /** Stored amount when the reader has one; otherwise quantity × price. */
  amount?: number;
};

/** The service part of a line: what it costs before its materials. */
export type LineServicePart = {
  quantity: number;
  /** Unit price; when unknown only the amount shows. */
  price?: number;
  amount: number;
};

const materialAmount = (item: LineMaterialDetail) => item.amount ?? materialDraftAmount(item);

type LineMaterialsToggleProps = {
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Id of the breakdown it shows. */
  controls: string;
  className?: string;
};

/** "N material(es) ⌄": opens the line's breakdown (ZIG-18). */
export const LineMaterialsToggle = ({
  count,
  open,
  onOpenChange,
  controls,
  className,
}: LineMaterialsToggleProps) => (
  <button
    type="button"
    aria-expanded={open}
    aria-controls={controls}
    onClick={() => onOpenChange(!open)}
    onKeyDown={(event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onOpenChange(!open);
    }}
    className={cn(
      'inline-flex min-h-11 items-center gap-0.5 rounded-md px-1 text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className,
    )}
  >
    {count === 1 ? '1 material' : `${count} materiales`}
    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
  </button>
);

type LineMaterialsBreakdownProps = {
  id?: string;
  materials: ReadonlyArray<LineMaterialDetail>;
  /** Service name, for the labels. */
  lineName: string;
  /** The service before materials; omit to list the materials alone. */
  service?: LineServicePart;
  className?: string;
};

/**
 * What a line is made of: Servicio and its amount, Materiales and their
 * subtotal, then each material with its own amount. Servicio + Materiales is
 * the line's total, shown on the line itself.
 */
export const LineMaterialsBreakdown = ({
  id,
  materials,
  lineName,
  service,
  className,
}: LineMaterialsBreakdownProps) => {
  const materialsTotal = materialDraftsTotal(
    materials.map((item) => ({ quantity: item.quantity, price: item.price })),
  );
  const listedTotal = materials.every((item) => item.amount != null)
    ? roundMoney(materials.reduce((sum, item) => sum + (item.amount ?? 0), 0))
    : materialsTotal;
  return (
    <div
      id={id}
      role="group"
      aria-label={`Desglose de ${lineName}`}
      data-testid="line-materials-breakdown"
      className={cn(
        'space-y-1.5 rounded-lg bg-muted/40 px-3 py-2.5 text-caption tabular-nums text-muted-foreground',
        className,
      )}
    >
      {service ? (
        <div className="flex items-baseline justify-between gap-3" data-testid="line-breakdown-service">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <span className="font-medium text-foreground">Servicio</span>
            {service.price != null ? (
              <>
                {' · '}
                {roundMoney(service.quantity)} × {formatServiceCurrency(service.price)}
              </>
            ) : null}
          </span>
          <span className="shrink-0 font-medium text-foreground">
            {formatServiceCurrency(service.amount)}
          </span>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between gap-3" data-testid="line-breakdown-materials">
        <span className="font-medium text-foreground">Materiales</span>
        <span className="shrink-0 font-medium text-foreground">
          {formatServiceCurrency(listedTotal)}
        </span>
      </div>
      <ul aria-label={`Materiales de ${lineName}`} className="space-y-1 border-l-2 border-border/60 pl-3">
        {materials.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 [overflow-wrap:anywhere]" title={item.name}>
              {item.name} · {formatMaterialQuantity(item.quantity, item.unit)} ×{' '}
              {formatServiceCurrency(item.price)}
            </span>
            <span className="shrink-0">{formatServiceCurrency(materialAmount(item))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

type LineMaterialsDisclosureProps = {
  materials: ReadonlyArray<LineMaterialDetail>;
  /** Service name, for the materials list label. */
  lineName: string;
  service?: LineServicePart;
  className?: string;
};

/**
 * "N material(es)" opens the line's breakdown (ZIG-18): Servicio, Materiales
 * and each material with its amount. Shared by the ticket/presupuesto summary;
 * the composer row places the toggle and the breakdown itself. The line total
 * stays where it is.
 */
export const LineMaterialsDisclosure = ({
  materials,
  lineName,
  service,
  className,
}: LineMaterialsDisclosureProps) => {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  if (materials.length === 0) return null;

  return (
    <div className={className}>
      <LineMaterialsToggle
        count={materials.length}
        open={open}
        onOpenChange={setOpen}
        controls={panelId}
      />
      {open ? (
        <LineMaterialsBreakdown
          id={panelId}
          materials={materials}
          lineName={lineName}
          service={service}
          className="mb-1"
        />
      ) : null}
    </div>
  );
};
