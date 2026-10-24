'use client';

import * as React from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';

import {
  LineMaterialsBreakdown,
  LineMaterialsToggle,
  type LineMaterialDetail,
} from '@/components/documents/line-materials-disclosure';
import { MoneyFigure } from '@/components/documents/money-figure';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { multiplyMoney, roundMoney } from '@/lib/money';
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
  /**
   * When set, "N material(es)" opens the line's breakdown: Servicio, Materiales
   * and each material with its amount. The line amount is not recomputed.
   */
  materials?: ReadonlyArray<LineMaterialDetail>;
  /** Marks a line that differs from the saved document (edit view). */
  changed?: boolean;
  /** What the server rejected on this line (ZIG-I12). */
  error?: string;
  /** Row is a button. Mutually exclusive with `href`. */
  onClick?: () => void;
  href?: string;
  /**
   * Desktop only (ZIG-I24-2): a Quitar button shows on hover or keyboard focus,
   * at the end of the row. Phones remove a line from its sheet.
   */
  onRemove?: () => void;
  className?: string;
  'data-testid'?: string;
};

/**
 * One service line of a document (ZIG-I13-1): the name uses the full width and
 * wraps; a second row holds `qty × price · N materiales` on the left and the
 * amount on the right, which is never squeezed. The whole row is one tap target
 * (no ⋮ menu): tapping opens the editor. From 1024px the hover background has
 * side padding (the text stays aligned) and `onRemove` adds a Quitar button.
 */
export const DocumentLineRow = ({
  name,
  quantity,
  price,
  amount,
  materialCount = 0,
  materials,
  changed = false,
  error,
  onClick,
  href,
  onRemove,
  className,
  'data-testid': testId = 'document-line-row',
}: DocumentLineRowProps) => {
  const [materialsOpen, setMaterialsOpen] = React.useState(false);
  const breakdownId = React.useId();
  const listed = materials ?? [];
  const count = listed.length > 0 ? listed.length : materialCount;
  const priceLabel = `${roundMoney(quantity)} × ${formatServiceCurrency(price)}`;
  const meta =
    listed.length > 0
      ? priceLabel
      : [priceLabel, count > 0 ? formatMaterialsCount(count) : null].filter(Boolean).join(' · ');

  const nameAndMoney = (
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
              className="text-caption font-medium text-amber-600 dark:text-amber-400"
              data-testid="document-line-changed"
            >
              Cambió
            </span>
          ) : null}
          <MoneyFigure amount={amount} data-testid="document-line-amount" />
        </span>
      </span>
    </>
  );

  const errorNode = error ? (
    <span
      role="alert"
      data-testid="document-line-error"
      className="mt-1 block text-caption font-medium text-destructive [overflow-wrap:anywhere]"
    >
      {error}
    </span>
  ) : null;

  const body = (
    <>
      {nameAndMoney}
      {errorNode}
    </>
  );

  const removable = Boolean(onRemove);
  // The grey hover reaches 12px past the text on desktop; the text does not move.
  const desktopBleed = 'lg:-mx-3 lg:w-[calc(100%+1.5rem)] lg:px-3';
  const hoverClass =
    'rounded-lg outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring';
  const rowClass = removable
    ? cn('block w-full min-w-0 flex-1 rounded-lg py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring')
    : cn(
        'block w-full min-w-0 py-3 text-left',
        desktopBleed,
        (onClick || href) && hoverClass,
        error && 'rounded-lg bg-destructive/5',
        className,
      );
  // With onRemove the wrapper carries the test id, the hover and the error state.
  const rowTestId = removable ? undefined : testId;
  const rowInvalid = !removable && error ? 'true' : undefined;

  const withRemove = (row: React.ReactNode) =>
    removable ? (
      <div
        className={cn(
          'group flex w-full min-w-0 items-center gap-2 rounded-lg transition-colors hover:bg-muted/40 focus-within:bg-muted/40',
          desktopBleed,
          error && 'bg-destructive/5',
          className,
        )}
        data-testid={testId}
        data-invalid={error ? 'true' : undefined}
      >
        {row}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${name}`}
          data-testid="document-line-remove"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 outline-none transition-[opacity,color,background-color] hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 group-focus-within:opacity-100 lg:inline-flex"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    ) : (
      row
    );

  if (listed.length > 0) {
    const hitClass = cn(
      'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
      (onClick || href) && 'transition-colors hover:text-foreground',
    );
    const nameNode = (
      <span className="block min-w-0 font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
        {name}
      </span>
    );
    const amountNode = (
      <span className="flex shrink-0 items-baseline gap-1.5">
        {changed ? (
          <span
            className="text-caption font-medium text-amber-600 dark:text-amber-400"
            data-testid="document-line-changed"
          >
            Cambió
          </span>
        ) : null}
        <MoneyFigure amount={amount} data-testid="document-line-amount" />
      </span>
    );
    return withRemove(
      <div className={rowClass} data-testid={rowTestId} data-invalid={rowInvalid}>
        {href ? (
          <Link href={href} className={cn('block w-full text-left', hitClass)}>
            {nameNode}
          </Link>
        ) : onClick ? (
          <button type="button" onClick={onClick} className={cn('block w-full text-left', hitClass)}>
            {nameNode}
          </button>
        ) : (
          nameNode
        )}
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <div
            className="min-w-0 text-sm tabular-nums text-muted-foreground [overflow-wrap:anywhere]"
            data-testid="document-line-meta"
          >
            <span>{priceLabel}</span>
            <span aria-hidden> · </span>
            <LineMaterialsToggle
              count={listed.length}
              open={materialsOpen}
              onOpenChange={setMaterialsOpen}
              controls={breakdownId}
              className="-my-3 align-baseline"
            />
          </div>
          {href ? (
            <Link href={href} className={hitClass} aria-label={`Total de ${name}`}>
              {amountNode}
            </Link>
          ) : onClick ? (
            <button type="button" onClick={onClick} className={hitClass} aria-label={`Editar ${name}`}>
              {amountNode}
            </button>
          ) : (
            amountNode
          )}
        </div>
        {materialsOpen ? (
          <LineMaterialsBreakdown
            id={breakdownId}
            materials={listed}
            lineName={name}
            service={{ quantity, price, amount: multiplyMoney(price, quantity) }}
            className="mt-2"
          />
        ) : null}
        {errorNode}
      </div>
    );
  }

  if (href) {
    return withRemove(
      <Link
        href={href}
        className={rowClass}
        data-testid={rowTestId}
        data-invalid={rowInvalid}
      >
        {body}
      </Link>
    );
  }
  if (onClick) {
    return withRemove(
      <button
        type="button"
        onClick={onClick}
        className={rowClass}
        data-testid={rowTestId}
        data-invalid={rowInvalid}
      >
        {body}
      </button>
    );
  }
  return withRemove(
    <div className={rowClass} data-testid={rowTestId} data-invalid={rowInvalid}>
      {body}
    </div>
  );
};
