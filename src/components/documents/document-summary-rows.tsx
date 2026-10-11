'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { formatMaterialQuantity } from '@/lib/material-drafts';
import { roundMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export type DocumentSummaryMaterial = {
  id: number | string;
  name: string;
  quantity: number;
  unit?: string | null;
  price: number;
  amount: number;
};

export type DocumentSummaryLine = {
  id: number | string;
  name: string;
  quantity: number;
  /** The line's amount, materials included. */
  amount: number;
  materials?: ReadonlyArray<DocumentSummaryMaterial>;
};

type DocumentSummaryRowsProps = {
  lines: ReadonlyArray<DocumentSummaryLine>;
  /** Rows shown before the toggle. */
  initialVisible?: number;
  /** Accessible name of the list, e.g. Servicios del ticket. */
  label?: string;
  className?: string;
};

export const summaryToggleLabel = (services: number, materials: number) => {
  const servicesText = services === 1 ? '1 servicio' : `${services} servicios`;
  if (materials === 0) return `Ver los ${servicesText}`;
  const materialsText = materials === 1 ? '1 material' : `${materials} materiales`;
  return `Ver los ${servicesText} y ${materialsText}`;
};

/**
 * Recibo-style compact rows `2 × Name … $amount` (ZIG-I13-1). The name
 * truncates with an ellipsis; the amount never does. Beyond `initialVisible`
 * rows, a toggle expands the rest (and each line's materials) in place.
 */
export const DocumentSummaryRows = ({
  lines,
  initialVisible = 3,
  label,
  className,
}: DocumentSummaryRowsProps) => {
  const [expanded, setExpanded] = React.useState(false);
  const listId = React.useId();
  const materialsCount = lines.reduce((sum, line) => sum + (line.materials?.length ?? 0), 0);
  const collapsible = lines.length > initialVisible || materialsCount > 0;
  const visible = expanded || !collapsible ? lines : lines.slice(0, initialVisible);

  return (
    <div className={className} data-testid="document-summary-rows">
      <ul id={listId} className="space-y-2" aria-label={label}>
        {visible.map((line) => (
          <li key={line.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-foreground" title={line.name}>
                <span className="tabular-nums text-muted-foreground">
                  {roundMoney(line.quantity)} ×{' '}
                </span>
                {line.name}
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatServiceCurrency(line.amount)}
              </span>
            </div>
            {expanded && line.materials && line.materials.length > 0 ? (
              <ul
                aria-label={`Materiales de ${line.name}`}
                className="mt-1 space-y-1 border-l-2 border-border/60 pl-3"
              >
                {line.materials.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground"
                  >
                    <span className="min-w-0 truncate" title={item.name}>
                      {item.name}{' '}
                      <span className="tabular-nums">
                        {formatMaterialQuantity(item.quantity, item.unit)} ×{' '}
                        {formatServiceCurrency(item.price)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatServiceCurrency(item.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={listId}
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? 'Ver menos' : summaryToggleLabel(lines.length, materialsCount)}
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
            aria-hidden
          />
        </button>
      ) : null}
    </div>
  );
};
