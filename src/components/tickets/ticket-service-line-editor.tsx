import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type TicketServiceLineEditorProps = {
  /** Unique per rendering (row vs sheet) so label/input ids never collide. */
  idPrefix: string;
  quantity: number | string;
  price: number | string;
  onQuantityStep: (nextQuantity: number) => void;
  onPriceStep: (nextPrice: number) => void;
  onQuantityInput: (value: string) => void;
  onPriceInput: (value: string) => void;
  /** Message under Cantidad / Precio (aria-invalid + aria-describedby). */
  quantityError?: string | null;
  priceError?: string | null;
  className?: string;
  /**
   * `sheet` (ZIG-I13-2): Cantidad and Precio always side by side, Cantidad as a
   * stepper and Precio as a plain money input. `responsive` keeps both steppers
   * and stacks them below `sm` (desktop row, ticket-services editor).
   */
  layout?: 'responsive' | 'sheet';
};

const toNumber = (value: number | string) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Cantidad / Precio steppers for one ticket line. Shared by the desktop row
 * (inline editing) and the mobile Editar sheet; callers own the semantics
 * (server round-trip vs local draft).
 */
export const TicketServiceLineEditor = ({
  idPrefix,
  quantity,
  price,
  onQuantityStep,
  onPriceStep,
  onQuantityInput,
  onPriceInput,
  quantityError = null,
  priceError = null,
  className,
  layout = 'responsive',
}: TicketServiceLineEditorProps) => {
  const quantityValue = toNumber(quantity);
  const priceValue = toNumber(price);
  const compact = layout === 'sheet';

  return (
    <div
      className={cn(
        'grid gap-3',
        compact ? 'grid-cols-2 items-start' : 'sm:grid-cols-2 sm:items-end',
        className,
      )}
    >
      <div className="min-w-0">
        <Label
          htmlFor={`${idPrefix}-quantity`}
          className="text-sm font-medium text-foreground"
        >
          Cantidad
        </Label>
        <div className={cn('flex items-center', compact ? 'mt-1.5 gap-1' : 'gap-2')}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn('shrink-0', compact ? 'h-12 w-9' : 'h-10 w-10')}
            onClick={() => onQuantityStep(Math.max(quantityValue - 1, 1))}
            aria-label="Reducir cantidad del servicio"
          >
            <Minus className="h-4 w-4" data-icon="inline-start" />
          </Button>
          <Input
            id={`${idPrefix}-quantity`}
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => onQuantityInput(e.target.value)}
            className={cn('w-full min-w-0 px-1 text-center', compact ? 'h-12' : 'sm:w-24')}
            aria-label="Cantidad del servicio"
            aria-invalid={quantityError ? true : undefined}
            aria-describedby={quantityError ? `${idPrefix}-quantity-error` : undefined}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn('shrink-0', compact ? 'h-12 w-9' : 'h-10 w-10')}
            onClick={() => onQuantityStep(quantityValue + 1)}
            aria-label="Aumentar cantidad del servicio"
          >
            <Plus className="h-4 w-4" data-icon="inline-start" />
          </Button>
        </div>
        {quantityError ? (
          <p
            id={`${idPrefix}-quantity-error`}
            role="alert"
            className="mt-1 text-xs text-destructive"
          >
            {quantityError}
          </p>
        ) : null}
      </div>
      <div className="min-w-0">
        <Label
          htmlFor={`${idPrefix}-price`}
          className="text-sm font-medium text-foreground"
        >
          Precio
        </Label>
        <div className={cn('flex items-center', compact ? 'mt-1.5' : 'gap-2')}>
          {compact ? null : (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() =>
                onPriceStep(Math.max(Number((priceValue - 1).toFixed(2)), 0))
              }
              aria-label="Reducir precio del servicio"
            >
              <Minus className="h-4 w-4" data-icon="inline-start" />
            </Button>
          )}
          <div className={cn('relative w-full', !compact && 'sm:w-40')}>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id={`${idPrefix}-price`}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={price}
              onChange={(e) => onPriceInput(e.target.value)}
              className={cn('w-full pl-8', compact ? 'h-12 text-right' : 'text-center')}
              aria-label="Precio del servicio"
              aria-invalid={priceError ? true : undefined}
              aria-describedby={priceError ? `${idPrefix}-price-error` : undefined}
            />
          </div>
          {compact ? null : (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => onPriceStep(Number((priceValue + 1).toFixed(2)))}
              aria-label="Aumentar precio del servicio"
            >
              <Plus className="h-4 w-4" data-icon="inline-start" />
            </Button>
          )}
        </div>
        {priceError ? (
          <p
            id={`${idPrefix}-price-error`}
            role="alert"
            className="mt-1 text-xs text-destructive"
          >
            {priceError}
          </p>
        ) : null}
      </div>
    </div>
  );
};
