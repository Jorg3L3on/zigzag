'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import {
  LineMaterialsBreakdown,
  LineMaterialsDisclosure,
  type LineServicePart,
} from '@/components/documents/line-materials-disclosure';
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
  /** Text of the collapsed toggle; defaults to "Ver el servicio" / "Ver los N servicios y M materiales". */
  toggleLabel?: (services: number, materials: number) => string;
  className?: string;
};

/**
 * "Ver el servicio" when there is one item, otherwise "Ver los N servicios".
 * Zero materials are omitted; one reads "y el material" (ZIG-17). With several
 * materials "los" distributes over both plurals ("Ver los 3 servicios y 2
 * materiales") but not over a singular, so one item gets "y los M materiales".
 */
export const summaryToggleLabelFor = (
  count: number,
  one: string,
  many: string,
  materials: number,
) => {
  const items = count === 1 ? `el ${one}` : `los ${count} ${many}`;
  if (materials === 0) return `Ver ${items}`;
  if (materials === 1) return `Ver ${items} y el material`;
  const materialsText = count === 1 ? `los ${materials} materiales` : `${materials} materiales`;
  return `Ver ${items} y ${materialsText}`;
};

export const summaryToggleLabel = (services: number, materials: number) =>
  summaryToggleLabelFor(services, 'servicio', 'servicios', materials);

/** The service part of a summary line: its amount less its materials. */
const summaryService = (line: DocumentSummaryLine): LineServicePart => ({
  quantity: line.quantity,
  amount: roundMoney(line.amount - (line.materials ?? []).reduce((sum, item) => sum + item.amount, 0)),
});

/**
 * Recibo-style compact rows `2 × Name … $amount` (ZIG-I13-1). The name
 * truncates with an ellipsis; the amount never does. Beyond `initialVisible`
 * rows, a toggle expands the rest (and each line's materials) in place.
 */
export const DocumentSummaryRows = ({
  lines,
  initialVisible = 3,
  label,
  toggleLabel = summaryToggleLabel,
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
            {!expanded && line.materials && line.materials.length > 0 ? (
              <LineMaterialsDisclosure
                materials={line.materials}
                lineName={line.name}
                service={summaryService(line)}
                className="mt-0.5"
              />
            ) : null}
            {expanded && line.materials && line.materials.length > 0 ? (
              <LineMaterialsBreakdown
                materials={line.materials}
                lineName={line.name}
                service={summaryService(line)}
                className="mt-1"
              />
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
          {expanded ? 'Ver menos' : toggleLabel(lines.length, materialsCount)}
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
            aria-hidden
          />
        </button>
      ) : null}
    </div>
  );
};
