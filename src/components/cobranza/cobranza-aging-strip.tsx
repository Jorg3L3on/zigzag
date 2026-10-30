'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FormattedCurrency } from '@/components/formatted-currency';
import type { CobranzaBucketSummary, CobranzaAgingBucket } from '@/lib/cobranza';
import { cn } from '@/lib/utils';

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

type StripTab = {
  bucket: CobranzaAgingBucket;
  label: string;
  /** Past 90 days the card reads red, with a red bottom edge (canvas CobA). */
  danger?: boolean;
};

const TABS: StripTab[] = [
  { bucket: 'all', label: 'Por cobrar' },
  { bucket: '0-30', label: '0–30 días' },
  { bucket: '31-90', label: '31–90 días' },
  { bucket: '90+', label: 'Más de 90 días', danger: true },
];

const CARD_CLASS =
  'flex min-w-0 flex-col items-start gap-0.5 rounded-xl border border-b-[3px] px-4 py-3.5 text-left';
const LABEL_CLASS = 'text-caption lg:text-[11px]/[inherit] font-semibold uppercase tracking-[0.08em]';
const VALUE_CLASS = 'mt-1 text-[22px] font-semibold leading-tight tracking-tight tabular-nums';
const SECONDARY_CLASS = 'mt-0.5 w-full text-caption lg:text-xs font-normal leading-4 tabular-nums text-muted-foreground';

/** «octubre» from the `YYYY-MM` the server counted payments in. */
const monthName = (month: string | null | undefined): string => {
  const match = /^(\d{4})-(\d{2})$/.exec(month ?? '');
  if (!match) return 'este mes';
  return `en ${format(new Date(Number(match[1]), Number(match[2]) - 1, 15), 'MMMM', { locale: es })}`;
};

type CobranzaAgingStripProps = {
  buckets: CobranzaBucketSummary | null;
  collectedThisMonth: { amount: number; payments: number; month?: string } | null;
  value: CobranzaAgingBucket;
  onChange: (value: CobranzaAgingBucket) => void;
  /** id of the table the tabs filter. */
  controls: string;
  /** Por cliente leaves the average out of Por cobrar (canvas CobB). */
  view?: 'ticket' | 'client';
};

/**
 * Aging strip: amounts live here (pinned decision f18a2f7d keeps them off the
 * list tabs). The first four cards filter the table; Cobrado en <mes> only informs.
 */
export const CobranzaAgingStrip = ({
  buckets,
  collectedThisMonth,
  value,
  onChange,
  controls,
  view = 'ticket',
}: CobranzaAgingStripProps) => (
  <div
    className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]"
    data-testid="cobranza-aging-strip"
  >
    <div role="tablist" aria-label="Días sin pagar" className="contents">
      {TABS.map((tab) => {
        const totals = buckets?.[tab.bucket] ?? null;
        const selected = value === tab.bucket;
        let secondary = ' ';
        if (totals) {
          const parts = [plural(totals.count, 'ticket', 'tickets')];
          if (tab.bucket === 'all') {
            parts.push(plural(buckets?.clients ?? 0, 'cliente', 'clientes'));
            if (view === 'ticket') parts.push(`promedio ${buckets?.averageDays ?? 0} días`);
          }
          if (tab.danger && view === 'ticket' && totals.count > 0) {
            parts.push(`el más viejo ${totals.oldestDays} días`);
          }
          secondary = parts.join(' · ');
        }
        const empty = totals != null && totals.amount <= 0;
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
              CARD_CLASS,
              'outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              selected
                ? 'border-primary bg-primary/10'
                : 'border-border/70 bg-card hover:bg-muted/50',
              tab.danger && 'border-b-red-500',
            )}
          >
            <span
              className={cn(
                LABEL_CLASS,
                tab.danger ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </span>
            <span
              className={cn(
                VALUE_CLASS,
                empty
                  ? 'text-muted-foreground'
                  : tab.danger
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-foreground',
              )}
              data-testid={`cobranza-bucket-${tab.bucket}-amount`}
            >
              {totals ? <FormattedCurrency amount={totals.amount} /> : '—'}
            </span>
            <span className={SECONDARY_CLASS}>{secondary}</span>
          </button>
        );
      })}
    </div>
    <div
      className={cn(CARD_CLASS, 'border-border/70 border-b-emerald-500 bg-card')}
      data-testid="cobranza-collected-month"
    >
      <span className={cn(LABEL_CLASS, 'text-emerald-700 dark:text-emerald-400')}>
        Cobrado {monthName(collectedThisMonth?.month)}
      </span>
      <span className={cn(VALUE_CLASS, 'text-emerald-700 dark:text-emerald-400')}>
        {collectedThisMonth ? <FormattedCurrency amount={collectedThisMonth.amount} /> : '—'}
      </span>
      <span className={SECONDARY_CLASS}>
        {collectedThisMonth ? plural(collectedThisMonth.payments, 'pago', 'pagos') : ' '}
      </span>
    </div>
  </div>
);
