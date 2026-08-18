'use client';

import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormattedCurrency } from '@/components/formatted-currency';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
import { DashboardKpiSparkline } from '@/components/dashboard/dashboard-kpi-sparkline';
import type { DashboardKpi } from '@/lib/dashboard-kpi';
import { formatCompactCurrency, formatCompactNumber } from '@/lib/format-compact';
import { cn } from '@/lib/utils';

type DashboardKpiCardProps = {
  kpi: DashboardKpi;
  icon: ReactNode;
};

const formatDelta = (deltaPercent: number | null): string => {
  if (deltaPercent === null) {
    return '—';
  }
  const sign = deltaPercent > 0 ? '+' : '';
  return `${sign}${deltaPercent.toFixed(1)}%`;
};

export const DashboardKpiCard = ({ kpi, icon }: DashboardKpiCardProps) => {
  const delta = kpi.deltaPercent;
  const isUp = delta !== null && delta > 0;
  const isDown = delta !== null && delta < 0;
  const isNeutral = delta === null || delta === 0;
  const compactValue =
    kpi.format === 'currency'
      ? formatCompactCurrency(kpi.value)
      : formatCompactNumber(kpi.value);

  return (
    <div className="h-full min-w-0">
      <Card className={cn(DASHBOARD_CARD_CLASS, 'flex h-full flex-col overflow-hidden')}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-3 sm:p-5 sm:pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {kpi.label}
          </CardTitle>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground"
            aria-hidden
          >
            {icon}
          </span>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="space-y-2">
            <p className="text-2xl font-semibold tracking-tight tabular-nums leading-none sm:text-3xl">
              {compactValue}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <div
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium tabular-nums',
                  isUp && 'text-emerald-600 dark:text-emerald-400',
                  isDown && 'text-red-600 dark:text-red-400',
                  isNeutral && 'text-muted-foreground',
                )}
                aria-label={
                  delta === null
                    ? 'Sin comparación con el mes anterior'
                    : `${formatDelta(delta)} frente al mes anterior`
                }
              >
                {!isNeutral && !isDown ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : null}
                {!isNeutral && isDown ? (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : null}
                <span>{formatDelta(delta)}</span>
              </div>
              <span className="text-xs text-muted-foreground">vs mes anterior</span>
            </div>
            {kpi.format === 'currency' ? (
              <p className="text-xs text-muted-foreground/80 tabular-nums">
                <FormattedCurrency amount={kpi.value} />
              </p>
            ) : null}
          </div>
          <DashboardKpiSparkline
            values={kpi.sparkline.map((point) => point.value)}
            label={`Tendencia de ${kpi.label}, últimos ${kpi.sparkline.length} meses`}
          />
        </CardContent>
      </Card>
    </div>
  );
};
