'use client';

import { Trash2 } from 'lucide-react';

import { InlineLineChips } from '@/components/tickets/service-line-source-fields';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { Button } from '@/components/ui/button';
import {
  formatMaterialQuantity,
  materialDraftAmount,
  type MaterialDraft,
} from '@/lib/material-drafts';
import { cn } from '@/lib/utils';

type MaterialRowsProps = {
  materials: MaterialDraft[];
  onEdit: (key: string) => void;
  onRemove: (key: string) => void;
  /** Inline materials get the Nuevo chip (document lines only). */
  showInlineChips?: boolean;
  className?: string;
  'data-testid'?: string;
};

/**
 * Editable material rows: tap the row to edit, Quitar on the right (44px
 * targets). `name · qty unit × price` with the amount right-aligned.
 */
export const MaterialRows = ({
  materials,
  onEdit,
  onRemove,
  showInlineChips = false,
  className,
  'data-testid': testId,
}: MaterialRowsProps) => {
  if (materials.length === 0) return null;
  return (
    <ul
      className={cn('divide-y divide-border/60 rounded-xl border border-border/70', className)}
      data-testid={testId}
    >
      {materials.map((item) => (
        <li key={item.key} className="flex items-center gap-1 pr-1">
          <button
            type="button"
            onClick={() => onEdit(item.key)}
            aria-label={`Editar ${item.name}`}
            className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-l-xl px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
          >
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-medium">{item.name}</span>
                {showInlineChips ? (
                  <InlineLineChips
                    isInline={item.material_id == null}
                    saveToCatalog={item.save_to_catalog}
                    className="shrink-0"
                  />
                ) : null}
              </span>
              <span className="block truncate text-xs tabular-nums text-muted-foreground">
                {formatMaterialQuantity(item.quantity, item.unit)} ×{' '}
                {formatServiceCurrency(item.price)}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatServiceCurrency(materialDraftAmount(item))}
            </span>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Quitar ${item.name}`}
            onClick={() => onRemove(item.key)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
};
