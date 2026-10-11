'use client';

import { Trash2, X } from 'lucide-react';

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
  /**
   * Line-sheet look (ZIG-I13-2): no outer frame, an × to remove, and the name,
   * `qty unit × price` and amount wrap instead of truncating.
   */
  compact?: boolean;
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
  compact = false,
  className,
  'data-testid': testId,
}: MaterialRowsProps) => {
  if (materials.length === 0) return null;
  const RemoveIcon = compact ? X : Trash2;
  return (
    <ul
      className={cn(
        'divide-y divide-border/60',
        !compact && 'rounded-xl border border-border/70',
        className,
      )}
      data-testid={testId}
    >
      {materials.map((item) => (
        <li key={item.key} className={cn('flex items-center gap-1', !compact && 'pr-1')}>
          <button
            type="button"
            onClick={() => onEdit(item.key)}
            aria-label={`Editar ${item.name}`}
            className={cn(
              'flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none',
              compact ? 'rounded-lg' : 'rounded-l-xl px-3',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span
                  className={cn(
                    'min-w-0 text-sm font-medium',
                    compact ? '[overflow-wrap:anywhere]' : 'break-words',
                  )}
                >
                  {item.name}
                </span>
                {showInlineChips ? (
                  <InlineLineChips
                    isInline={item.material_id == null}
                    saveToCatalog={item.save_to_catalog}
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  'block text-xs tabular-nums text-muted-foreground',
                  compact ? '[overflow-wrap:anywhere]' : 'truncate',
                )}
              >
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
            className={cn(
              'shrink-0 text-muted-foreground hover:text-destructive',
              compact ? 'h-11 w-10' : 'h-11 w-11',
            )}
            aria-label={`Quitar ${item.name}`}
            onClick={() => onRemove(item.key)}
          >
            <RemoveIcon className="h-4 w-4" aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
};
