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
  className?: string;
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
  className,
}: TicketServiceLineEditorProps) => {
  const quantityValue = toNumber(quantity);
  const priceValue = toNumber(price);

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 sm:items-end', className)}>
      <div>
        <Label
          htmlFor={`${idPrefix}-quantity`}
          className="text-sm font-medium text-foreground"
        >
          Cantidad
        </Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => onQuantityStep(Math.max(quantityValue - 1, 1))}
            aria-label="Reducir cantidad del servicio"
          >
            <Minus className="h-4 w-4" data-icon="inline-start" />
          </Button>
          <Input
            id={`${idPrefix}-quantity`}
            type="number"
            min="1"
            inputMode="numeric"
            pattern="[0-9]*"
            value={quantity}
            onChange={(e) => onQuantityInput(e.target.value)}
            className="w-full text-center sm:w-24"
            aria-label="Cantidad del servicio"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => onQuantityStep(quantityValue + 1)}
            aria-label="Aumentar cantidad del servicio"
          >
            <Plus className="h-4 w-4" data-icon="inline-start" />
          </Button>
        </div>
      </div>
      <div>
        <Label
          htmlFor={`${idPrefix}-price`}
          className="text-sm font-medium text-foreground"
        >
          Precio
        </Label>
        <div className="flex items-center gap-2">
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
          <div className="relative w-full sm:w-40">
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
              className="w-full pl-8 text-center"
              aria-label="Precio del servicio"
            />
          </div>
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
        </div>
      </div>
    </div>
  );
};
