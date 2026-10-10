import * as React from 'react';
import Link from 'next/link';

import { MoneyFigure } from '@/components/documents/money-figure';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { roundMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export const formatMaterialsCount = (count: number) =>
  count === 1 ? '1 material' : `${count} materiales`;

type DocumentLineRowProps = {
  name: string;
  quantity: number;
  /** Unit price, before materials. */
  price: number;
  /** The line's amount: quantity × price plus its materials. */
  amount: number;
  materialCount?: number;
  /** Marks a line that differs from the saved document (edit view). */
  changed?: boolean;
  /** What the server rejected on this line (ZIG-I12). */
  error?: string;
  /** Row is a button. Mutually exclusive with `href`. */
  onClick?: () => void;
  href?: string;
  className?: string;
  'data-testid'?: string;
};

/**
 * One service line of a document (ZIG-I13-1): the name uses the full width and
 * wraps; a second row holds `qty × price · N materiales` on the left and the
 * amount on the right, which is never squeezed. The whole row is one tap target
 * (no ⋮ menu): tapping opens the editor.
 */
export const DocumentLineRow = ({
  name,
  quantity,
  price,
  amount,
  materialCount = 0,
  changed = false,
  error,
  onClick,
  href,
  className,
  'data-testid': testId = 'document-line-row',
}: DocumentLineRowProps) => {
  const meta = [
    `${roundMoney(quantity)} × ${formatServiceCurrency(price)}`,
    materialCount > 0 ? formatMaterialsCount(materialCount) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const body = (
    <>
      <span className="block min-w-0 font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
        {name}
      </span>
      <span className="mt-1 flex items-baseline justify-between gap-3">
        <span
          className="min-w-0 text-sm tabular-nums text-muted-foreground [overflow-wrap:anywhere]"
          data-testid="document-line-meta"
        >
          {meta}
        </span>
        <span className="flex shrink-0 items-baseline gap-1.5">
          {changed ? (
            <span
              className="text-xs font-medium text-amber-600 dark:text-amber-400"
              data-testid="document-line-changed"
            >
              Cambió
            </span>
          ) : null}
          <MoneyFigure amount={amount} data-testid="document-line-amount" />
        </span>
      </span>
      {error ? (
        <span
          role="alert"
          data-testid="document-line-error"
          className="mt-1 block text-xs font-medium text-destructive [overflow-wrap:anywhere]"
        >
          {error}
        </span>
      ) : null}
    </>
  );

  const rowClass = cn(
    'block w-full min-w-0 py-3 text-left',
    (onClick || href) &&
      'rounded-lg outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring',
    error && 'rounded-lg bg-destructive/5',
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        className={rowClass}
        data-testid={testId}
        data-invalid={error ? 'true' : undefined}
      >
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={rowClass}
        data-testid={testId}
        data-invalid={error ? 'true' : undefined}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={rowClass} data-testid={testId} data-invalid={error ? 'true' : undefined}>
      {body}
    </div>
  );
};
