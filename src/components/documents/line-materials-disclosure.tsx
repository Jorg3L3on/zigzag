'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { formatMaterialQuantity } from '@/lib/material-drafts';
import { cn } from '@/lib/utils';

export type LineMaterialDetail = {
  id: number | string;
  name: string;
  quantity: number;
  unit?: string | null;
  price: number;
};

type LineMaterialsDisclosureProps = {
  materials: ReadonlyArray<LineMaterialDetail>;
  /** Service name, for the materials list label. */
  lineName: string;
  className?: string;
};

/**
 * "N material(es)" opens the name, quantity and price of each material
 * (ZIG-18). Shared by the composer line and the ticket/presupuesto summary.
 * The line total stays where it is: this list does not recompute it.
 */
export const LineMaterialsDisclosure = ({
  materials,
  lineName,
  className,
}: LineMaterialsDisclosureProps) => {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  if (materials.length === 0) return null;

  const handleToggle = () => setOpen((value) => !value);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleToggle();
  };

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="inline-flex min-h-11 items-center gap-0.5 rounded-md px-1 text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {materials.length === 1 ? '1 material' : `${materials.length} materiales`}
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          id={panelId}
          aria-label={`Materiales de ${lineName}`}
          className="mb-1 space-y-1 border-l-2 border-border/60 pl-3"
        >
          {materials.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-3 text-caption text-muted-foreground"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]" title={item.name}>
                {item.name}{' '}
                <span className="tabular-nums">
                  {formatMaterialQuantity(item.quantity, item.unit)} ×{' '}
                  {formatServiceCurrency(item.price)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
