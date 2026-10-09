'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { DrawCheck, NumberTicker } from '@/components/motion';
import { InlineLineChips } from '@/components/tickets/service-line-source-fields';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { GLASS_CARD_CLASS } from '@/components/toolbar-glass';
import { multiplyMoney } from '@/lib/money';

/**
 * Pieces shared by the ticket (ZIG-I2-5) and presupuesto (ZIG-I5-4) review and
 * detail screens: the PDF-viewer capability check, the success header and the
 * lines + total card.
 */

export const REVIEW_SECTION_CLASS = GLASS_CARD_CLASS;

export type ReviewLine = {
  id: number;
  /** Null for an inline line (ZIG-I5). */
  serviceId: number | null;
  name: string;
  quantity: number;
  price: number;
};

const subscribeNoop = () => () => {};
const readPdfViewerEnabled = () =>
  typeof navigator !== 'undefined' &&
  (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled === true;
const serverPdfViewerEnabled = () => false;

/** Inline PDF only where the browser can render it (not Android Chrome, not headless). */
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
        <li key={line.id} className="flex items-start gap-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="font-medium leading-snug">{line.name}</span>
              {showInlineChips ? (
                <InlineLineChips isInline={line.serviceId == null} />
              ) : null}
            </div>
            <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
              {line.quantity} × {formatServiceCurrency(line.price)}
            </p>
          </div>
          <span className="shrink-0 font-semibold tabular-nums">
            {formatServiceCurrency(multiplyMoney(line.price, line.quantity))}
          </span>
        </li>
      ))}
    </ul>
    <div className="mt-1 flex items-baseline justify-between border-t border-border/60 pt-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Total
      </span>
      <NumberTicker
        value={total}
        format={formatServiceCurrency}
        className="text-2xl font-semibold"
        data-testid="review-total"
      />
    </div>
  </section>
);
