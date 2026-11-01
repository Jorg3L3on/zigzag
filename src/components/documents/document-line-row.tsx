'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, Trash2 } from 'lucide-react';

import {
  LineMaterialsBreakdown,
  LineMaterialsToggle,
  lineMaterialsListedTotal,
  type LineMaterialDetail,
} from '@/components/documents/line-materials-disclosure';
import { MoneyFigure } from '@/components/documents/money-figure';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { useDocumentLinesDensity } from '@/hooks/use-document-lines-density';
import { useIsDesktop } from '@/hooks/use-desktop';
import type { DocumentLinesDensity } from '@/lib/document-lines-density';
import { lineTotalWithMaterials, multiplyMoney, roundMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export const formatMaterialsCount = (count: number) =>
  count === 1 ? '1 material' : `${count} materiales`;

const RECEIPT_COLUMNS = 'grid-cols-[minmax(0,1fr)_72px_120px_130px]';

const formatCapturedQuantity = (quantity: number) => String(roundMoney(quantity));

const formatLineIndex = (index: number) => String(index).padStart(2, '0');

const materialsChipLabel = (count: number, total: number) =>
  `${count === 1 ? '1 material' : `${count} materiales`} · ${formatServiceCurrency(total)}`;

type DocumentLineRowProps = {
  name: string;
  quantity: number;
  /** Unit price, before materials. */
  price: number;
  /** The line's amount: quantity × price plus its materials. */
  amount: number;
  /**
   * `stack` is the phone row and the composer. `receipt` is the desktop
   * document grid from 1024px (ZIG-I28-1); below that it still paints `stack`.
   */
  layout?: 'stack' | 'receipt';
  /** 1-based position, printed as two digits on the receipt grid. */
  index?: number;
  /** Full description under the name. Receipt desktop only. */
  description?: string;
  /** Null marks an inline line (Fuera de catálogo) on the receipt grid. */
  serviceId?: number | null;
  /** Overrides the stored Detallado / Compacto choice. Receipt desktop only. */
  density?: DocumentLinesDensity;
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

type ReceiptDocumentLineProps = DocumentLineRowProps & {
  density: DocumentLinesDensity;
};

/**
 * Desktop document row (ZIG-I28-1): Concepto · Cant. · P. unitario · Importe.
 * Importe is the service only (quantity × price). Materials sit in a rail
 * under the name and share those numeric columns.
 */
const ReceiptDocumentLine = ({
  name,
  quantity,
  price,
  index,
  description,
  serviceId,
  density,
  materials,
  changed = false,
  error,
  className,
  'data-testid': testId = 'document-line-row',
}: ReceiptDocumentLineProps) => {
  const [materialsOpen, setMaterialsOpen] = React.useState(false);
  const breakdownId = React.useId();
  const listed = materials ?? [];
  const serviceAmount = multiplyMoney(price, quantity);
  const groupTotal = lineTotalWithMaterials({
    quantity,
    price,
    materials: listed.map((item) => ({ quantity: item.quantity, price: item.price })),
  });
  const showMaterials = listed.length > 0 && (density === 'detailed' || materialsOpen);
  const descriptionText = description?.trim() ?? '';
  // Compacto shows two lines of a long description with «más» (canvas); Detallado all of it.
  const [descriptionOpen, setDescriptionOpen] = React.useState(false);
  const longDescription = descriptionText.length > 110;
  const clampDescription = density === 'compact' && longDescription && !descriptionOpen;

  return (
    <div
      className={cn('grid items-baseline gap-x-2 py-3', RECEIPT_COLUMNS, className)}
      data-testid={testId}
      data-layout="receipt"
      data-density={density}
      data-invalid={error ? 'true' : undefined}
    >
      <div className="min-w-0">
        {/* Canvas Linea: the index in a 26px column, the description under the name. */}
        <p className="flex items-baseline text-[15px] font-semibold leading-snug text-foreground">
          {index != null ? (
            <span className="w-[26px] shrink-0 font-mono text-caption lg:text-[11px]/[inherit] font-normal tabular-nums text-muted-foreground">
              {formatLineIndex(index)}
            </span>
          ) : null}
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {name}
            {serviceId === null ? (
              <span
                className="ml-2 inline-flex h-5 items-center rounded-md bg-indigo-50 px-1.5 align-middle text-caption lg:text-[11px]/[inherit] font-semibold text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200"
                data-testid="document-line-uncatalogued"
              >
                Fuera de catálogo
              </span>
            ) : null}
          </span>
        </p>
        {descriptionText ? (
          <div className={cn(index != null && 'pl-[26px]')}>
            <p
              className={cn(
                'mt-0.5 text-caption leading-snug lg:text-[13px] text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400',
                clampDescription && 'line-clamp-2',
              )}
              data-testid="document-line-description"
            >
              {descriptionText}
            </p>
            {density === 'compact' && longDescription ? (
              <button
                type="button"
                aria-expanded={descriptionOpen}
                onClick={() => setDescriptionOpen((open) => !open)}
                className="text-caption lg:text-[13px]/[inherit] font-medium text-primary outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {descriptionOpen ? 'menos' : 'más'}
              </button>
            ) : null}
          </div>
        ) : null}
        {changed ? (
          <span
            className={cn('mt-1 block text-caption font-medium text-amber-600 dark:text-amber-400', index != null && 'pl-[26px]')}
            data-testid="document-line-changed"
          >
            Cambió
          </span>
        ) : null}
      </div>
      <span
        className="text-right text-sm tabular-nums text-foreground"
        data-testid="document-line-meta"
      >
        {formatCapturedQuantity(quantity)}
      </span>
      <span className="text-right">
        <MoneyFigure amount={price} size="sm" />
      </span>
      <span className="text-right">
        <MoneyFigure amount={serviceAmount} size="sm" data-testid="document-line-amount" />
      </span>
      {density === 'compact' && listed.length > 0 ? (
        // Canvas Compacto: the materials chip on the left, the subtotal on the right.
        <div className={cn('col-span-4 mt-2.5 flex items-center justify-between gap-3', index != null && 'pl-[26px]')}>
          <button
            type="button"
            aria-expanded={materialsOpen}
            aria-controls={breakdownId}
            onClick={() => setMaterialsOpen((open) => !open)}
            data-testid="document-line-materials-chip"
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 text-caption lg:text-[13px]/[inherit] font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-slate-200"
          >
            {materialsChipLabel(listed.length, lineMaterialsListedTotal(listed))}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', materialsOpen && 'rotate-180')} aria-hidden />
          </button>
          <span className="text-caption lg:text-[13px]/[inherit] text-muted-foreground" data-testid="document-line-subtotal">
            Subtotal{' '}
            <MoneyFigure amount={groupTotal} size="sm" className="text-foreground" />
          </span>
        </div>
      ) : null}
      {showMaterials ? (
        <LineMaterialsBreakdown
          id={breakdownId}
          layout="receipt"
          materials={listed}
          lineName={name}
          service={{ quantity, price, amount: serviceAmount }}
        />
      ) : null}
      {density === 'detailed' && listed.length > 0 ? (
        <div className="col-span-4 mt-1 grid grid-cols-subgrid items-baseline border-t border-dashed border-border pt-1.5">
          <span
            className="min-w-0 text-caption text-muted-foreground [overflow-wrap:anywhere]"
            data-testid="document-line-subtotal"
          >
            Subtotal {name} · servicio + materiales
          </span>
          <span />
          <span />
          <span className="text-right">
            <MoneyFigure amount={groupTotal} size="sm" />
          </span>
        </div>
      ) : null}
      {error ? (
        <span
          role="alert"
          data-testid="document-line-error"
          className="col-span-4 mt-1 text-caption font-medium text-destructive [overflow-wrap:anywhere]"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
};

/**
 * One service line of a document (ZIG-I13-1): the name uses the full width and
 * wraps; a second row holds `qty × price · N materiales` on the left and the
 * amount on the right, which is never squeezed. The whole row is one tap target
 * (no ⋮ menu): tapping opens the editor. From 1024px the hover background has
 * side padding (the text stays aligned) and `onRemove` adds a Quitar button.
 * `layout="receipt"` swaps in the desktop grid from 1024px (ZIG-I28-1).
 */
export const DocumentLineRow = ({
  name,
  quantity,
  price,
  amount,
  layout = 'stack',
  index,
  description,
  serviceId,
  density,
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
  const isDesktop = useIsDesktop();
  const storedDensity = useDocumentLinesDensity();
  const [materialsOpen, setMaterialsOpen] = React.useState(false);
  const breakdownId = React.useId();
  if (layout === 'receipt' && isDesktop) {
    return (
      <ReceiptDocumentLine
        name={name}
        quantity={quantity}
        price={price}
        amount={amount}
        index={index}
        description={description}
        serviceId={serviceId}
        density={density ?? storedDensity.density}
        materials={materials}
        changed={changed}
        error={error}
        className={className}
        data-testid={testId}
      />
    );
  }
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
