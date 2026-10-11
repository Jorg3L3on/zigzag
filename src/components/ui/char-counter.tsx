import { shouldShowCounter } from '@/lib/composer-limits';
import { cn } from '@/lib/utils';

type CharCounterProps = {
  value: string;
  max: number;
  id?: string;
  className?: string;
};

/**
 * `n/max` that appears once 80% of a limit is used, so a field that silently
 * stops accepting text (names, notes) says why before it does (ZIG-I12).
 */
export const CharCounter = ({ value, max, id, className }: CharCounterProps) =>
  shouldShowCounter(value.length, max) ? (
    <span
      id={id}
      aria-live="polite"
      data-testid="char-counter"
      className={cn(
        'text-xs tabular-nums',
        value.length >= max ? 'font-medium text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      {value.length.toLocaleString('en-US')}/{max.toLocaleString('en-US')}
    </span>
  ) : null;
