'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { DrawCheck, NumberTicker } from '@/components/motion';
import { InlineLineChips } from '@/components/tickets/service-line-source-fields';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { GLASS_CARD_CLASS } from '@/components/toolbar-glass';
import { formatMaterialQuantity, materialDraftAmount } from '@/lib/material-drafts';
import { multiplyMoney, subtractMoney } from '@/lib/money';
import {
  reviewLineAmount,
  type ReviewLine,
  type ReviewLineMaterial,
} from '@/lib/review-lines';

/**
 * Pieces shared by the ticket (ZIG-I2-5) and presupuesto (ZIG-I5-4) review and
 * detail screens: the PDF-viewer capability check, the success header and the
 * lines + total card.
 */

export const REVIEW_SECTION_CLASS = GLASS_CARD_CLASS;

export type { ReviewLine, ReviewLineMaterial };

/** Materials of one line, indented under it (ZIG-I10). */
export const ReviewLineMaterials = ({
  materials,
  showInlineChips = false,
}: {
  materials: ReviewLineMaterial[] | undefined;
  showInlineChips?: boolean;
}) => {
  if (!materials || materials.length === 0) return null;
  return (
    <ul
      className="mt-1.5 space-y-1 border-l-2 border-border/60 pl-3"
      aria-label="Materiales"
      data-testid="review-line-materials"
    >
      {materials.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 text-xs">
          <span className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">
            <span className="text-foreground/80">{item.name}</span>
            {showInlineChips ? (
              <InlineLineChips isInline={item.inline} className="ml-1" />
            ) : null}
            <span className="block tabular-nums">
              {formatMaterialQuantity(item.quantity, item.unit)} ×{' '}
              {formatServiceCurrency(item.price)}
            </span>
          </span>
          <span className="shrink-0 text-right tabular-nums text-muted-foreground">
            {formatServiceCurrency(materialDraftAmount(item))}
          </span>
        </li>
      ))}
    </ul>
  );
};

const subscribeNoop = () => () => {};
const TOUCH_USER_AGENT = /Android|iPhone|iPad|iPod|Mobile/i;

/** Phones and tablets: the inline <object> leaves a blank box there (ZIG-I12). */
export const isTouchDevice = () =>
  typeof navigator !== 'undefined' &&
  (TOUCH_USER_AGENT.test(navigator.userAgent) ||
    (typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches));

const readPdfViewerEnabled = () =>
  typeof navigator !== 'undefined' &&
  (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled === true &&
  !isTouchDevice();
const serverPdfViewerEnabled = () => false;

/** Inline PDF only where the browser can render it (not touch devices, not headless). */
export const usePdfViewerEnabled = () =>
  React.useSyncExternalStore(
    subscribeNoop,
    readPdfViewerEnabled,
    serverPdfViewerEnabled,
  );

type ReviewSuccessHeaderProps = {
  title: string;
  subtitle?: string | null;
};

/** Green check that springs in, then the title (e.g. Ticket #N guardado). */
export const ReviewSuccessHeader = ({ title, subtitle }: ReviewSuccessHeaderProps) => {
  const reduceMotion = useReducedMotion();
  return (
    <header className="flex items-center gap-3 px-1 py-2" data-testid="review-header">
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={
          reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 22 }
        }
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      >
        <DrawCheck className="size-6" delay={0.1} />
      </motion.span>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
};

type ReviewLinesSectionProps = {
  lines: ReviewLine[];
  total: number;
  /** Accessible name of the list, e.g. Servicios del ticket. */
  linesLabel: string;
  /** Show the Nuevo chip on inline lines. */
  showInlineChips?: boolean;
};

/** Servicios card: compact lines and the Total with a count-up. */
export const ReviewLinesSection = ({
  lines,
  total,
  linesLabel,
  showInlineChips = false,
}: ReviewLinesSectionProps) => (
  <section aria-labelledby="review-lines-heading" className={REVIEW_SECTION_CLASS}>
    <h2 id="review-lines-heading" className="text-base font-semibold">
      Servicios
    </h2>
    <ul className="mt-2 divide-y divide-border/60" aria-label={linesLabel}>
      {lines.map((line) => (
        <li
          key={line.id}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 py-3"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="min-w-0 font-medium leading-snug [overflow-wrap:anywhere]">
                {line.name}
              </span>
              {showInlineChips ? (
                <InlineLineChips isInline={line.serviceId == null} />
              ) : null}
            </div>
            <p className="mt-0.5 text-sm tabular-nums text-muted-foreground [overflow-wrap:anywhere]">
              {line.quantity} × {formatServiceCurrency(line.price)}
            </p>
          </div>
          <span
            className="max-w-[55vw] text-right font-semibold tabular-nums [overflow-wrap:anywhere]"
            data-testid="review-line-amount"
          >
            {formatServiceCurrency(reviewLineAmount(line))}
          </span>
          {/* Same grid: material amounts end on the line amount's right edge. */}
          <div className="col-span-2 min-w-0">
            <ReviewLineMaterials
              materials={line.materials}
              showInlineChips={showInlineChips}
            />
          </div>
        </li>
      ))}
    </ul>
    <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border/60 pt-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Total
      </span>
      <NumberTicker
        value={total}
        format={formatServiceCurrency}
        className="min-w-0 text-right text-xl font-semibold [overflow-wrap:anywhere] min-[400px]:text-2xl"
        data-testid="review-total"
      />
    </div>
  </section>
);

type QuoteSummaryProps = {
  presupuestoId: string;
  clientName: string | null;
  dateLabel: string | null;
  expiresLabel: string | null;
  lines: ReviewLine[];
  total: number;
};

/** HTML stand-in for the PDF where the browser cannot show it inline. */
export const QuoteSummary = ({
  presupuestoId,
  clientName,
  dateLabel,
  expiresLabel,
  lines,
  total,
}: QuoteSummaryProps) => (
  <div
    data-testid="presupuesto-summary"
    className="rounded-xl border border-dashed border-border/80 bg-background p-4 text-sm"
  >
    <div className="flex items-baseline justify-between gap-3">
      <p className="font-semibold">Presupuesto #{presupuestoId}</p>
      {dateLabel ? <p className="text-xs text-muted-foreground">{dateLabel}</p> : null}
    </div>
    {clientName ? (
      <p className="mt-0.5 text-muted-foreground [overflow-wrap:anywhere]">{clientName}</p>
    ) : null}
    <ul className="mt-3 space-y-1.5">
      {lines.map((line) => (
        <li key={line.id}>
          <div className="flex justify-between gap-3">
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {line.quantity} × {line.name}
            </span>
            <span className="shrink-0 text-right tabular-nums">
              {formatServiceCurrency(multiplyMoney(line.price, line.quantity))}
            </span>
          </div>
          {(line.materials ?? []).map((item) => (
            <div
              key={item.id}
              className="flex justify-between gap-3 pl-3 text-xs text-muted-foreground"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                · {item.name} {formatMaterialQuantity(item.quantity, item.unit)}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatServiceCurrency(materialDraftAmount(item))}
              </span>
            </div>
          ))}
        </li>
      ))}
    </ul>
    <dl className="mt-3 space-y-1 border-t border-border/60 pt-3 tabular-nums">
      <div className="flex justify-between gap-3 font-semibold">
        <dt>Total</dt>
        <dd className="text-right [overflow-wrap:anywhere]">{formatServiceCurrency(total)}</dd>
      </div>
      <div className="flex justify-between gap-3 text-muted-foreground">
        <dt>Vigencia</dt>
        <dd>{expiresLabel ?? 'Sin vencimiento'}</dd>
      </div>
    </dl>
    <p className="mt-3 text-xs text-muted-foreground">
      Documento informativo — no es un recibo de pago.
    </p>
  </div>
);

type ReciboSummaryProps = {
  ticketId: string;
  clientName: string | null;
  dateLabel: string | null;
  lines: ReviewLine[];
  total: number;
  paid: number;
};

/** HTML stand-in for the PDF where the browser cannot show it inline. */
export const ReciboSummary = ({
  ticketId,
  clientName,
  dateLabel,
  lines,
  total,
  paid,
}: ReciboSummaryProps) => {
  const balance = Math.max(subtractMoney(total, paid), 0);
  return (
    <div
      data-testid="recibo-summary"
      className="rounded-xl border border-dashed border-border/80 bg-background p-4 text-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">Recibo · Ticket #{ticketId}</p>
        {dateLabel ? (
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        ) : null}
      </div>
      {clientName ? (
        <p className="mt-0.5 text-muted-foreground [overflow-wrap:anywhere]">
          {clientName}
        </p>
      ) : null}
      <ul className="mt-3 space-y-1.5">
        {lines.map((line) => (
          <li key={line.id}>
            <div className="flex justify-between gap-3">
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {line.quantity} × {line.name}
              </span>
              <span className="shrink-0 text-right tabular-nums">
                {formatServiceCurrency(multiplyMoney(line.price, line.quantity))}
              </span>
            </div>
            {(line.materials ?? []).map((item) => (
              <div
                key={item.id}
                className="flex justify-between gap-3 pl-3 text-xs text-muted-foreground"
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  · {item.name} {formatMaterialQuantity(item.quantity, item.unit)}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatServiceCurrency(materialDraftAmount(item))}
                </span>
              </div>
            ))}
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 border-t border-border/60 pt-3 tabular-nums">
        <div className="flex justify-between gap-3 font-semibold">
          <dt>Total</dt>
          <dd className="text-right [overflow-wrap:anywhere]">{formatServiceCurrency(total)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-muted-foreground">
          <dt>Pagado</dt>
          <dd className="text-right [overflow-wrap:anywhere]">{formatServiceCurrency(paid)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-muted-foreground">
          <dt>Saldo</dt>
          <dd className="text-right [overflow-wrap:anywhere]">{formatServiceCurrency(balance)}</dd>
        </div>
      </dl>
    </div>
  );
};
