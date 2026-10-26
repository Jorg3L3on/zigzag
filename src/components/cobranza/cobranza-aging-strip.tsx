'use client';

import { FormattedCurrency } from '@/components/formatted-currency';
import { FILTER_SELECTED_CLASS } from '@/components/list-filter';
import type { CobranzaBucketSummary, CobranzaAgingBucket } from '@/lib/cobranza';
import { cn } from '@/lib/utils';

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

type StripTab = {
  bucket: CobranzaAgingBucket;
  label: string;
  /** Amount tone: red past 90 days (ZIG-I31-2). */
  amountClassName?: string;
};

const TABS: StripTab[] = [
  { bucket: 'all', label: 'Por cobrar' },
  { bucket: '0-30', label: '0–30 días' },
  { bucket: '31-90', label: '31–90 días' },
  { bucket: '90+', label: 'Más de 90 días', amountClassName: 'text-red-700 dark:text-red-400' },
];

type CobranzaAgingStripProps = {
  buckets: CobranzaBucketSummary | null;
  collectedThisMonth: { amount: number; payments: number } | null;
  value: CobranzaAgingBucket;
  onChange: (value: CobranzaAgingBucket) => void;
  /** id of the table the tabs filter. */
  controls: string;
};

/**
 * Aging strip: amounts live here (pinned decision f18a2f7d keeps them off the
 * list tabs). The first four cards filter the table; Cobrado este mes only informs.
 */
export const CobranzaAgingStrip = ({
  buckets,
  collectedThisMonth,
  value,
  onChange,
  controls,
}: CobranzaAgingStripProps) => (
  <div
    className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5"
    data-testid="cobranza-aging-strip"
  >
    <div role="tablist" aria-label="Días sin pagar" className="contents">
      {TABS.map((tab) => {
        const totals = buckets?.[tab.bucket] ?? null;
        const selected = value === tab.bucket;
        const secondary =
          totals == null
            ? ' '
            : tab.bucket === 'all'
              ? [
                  plural(totals.count, 'ticket', 'tickets'),
                  plural(buckets?.clients ?? 0, 'cliente', 'clientes'),
                  `${buckets?.averageDays ?? 0} días en promedio`,
                ].join(' · ')
              : plural(totals.count, 'ticket', 'tickets');
        return (
          <button
            key={tab.bucket}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={controls}
            data-testid={`cobranza-bucket-${tab.bucket}`}
            onClick={() => onChange(tab.bucket)}
            className={cn(
              'flex min-w-0 flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              selected
                ? FILTER_SELECTED_CLASS
                : 'border-border/70 bg-card hover:bg-muted/50',
            )}
          >
            <span
              className={cn(
                'text-caption font-medium',
                selected ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </span>
            <span
              className={cn(
                'text-[22px] font-semibold leading-7 tabular-nums text-foreground',
                tab.amountClassName,
              )}
              data-testid={`cobranza-bucket-${tab.bucket}-amount`}
            >
              {totals ? <FormattedCurrency amount={totals.amount} /> : '—'}
            </span>
            <span className="w-full truncate text-caption font-normal text-muted-foreground">
              {secondary}
            </span>
          </button>
        );
      })}
    </div>
    <div
      className="flex min-w-0 flex-col items-start gap-1 rounded-xl border border-border/70 bg-card px-4 py-3"
      data-testid="cobranza-collected-month"
    >
      <span className="text-caption font-medium text-muted-foreground">Cobrado este mes</span>
      <span className="text-[22px] font-semibold leading-7 tabular-nums text-emerald-700 dark:text-emerald-400">
        {collectedThisMonth ? <FormattedCurrency amount={collectedThisMonth.amount} /> : '—'}
      </span>
      <span className="text-caption text-muted-foreground">
        {collectedThisMonth
          ? plural(collectedThisMonth.payments, 'pago', 'pagos')
          : ' '}
      </span>
    </div>
  </div>
);
