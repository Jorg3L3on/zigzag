'use client';

import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormattedCurrency } from '@/components/formatted-currency';
import { TripledMotionDiv, tripledFadeInUp } from '@/components/tripled/motion';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
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
  const shouldReduceMotion = useReducedMotion();
  const delta = kpi.deltaPercent;
  const isUp = delta !== null && delta > 0;
  const isDown = delta !== null && delta < 0;
  const isNeutral = delta === null || delta === 0;

  const sparklineData = kpi.sparkline.map((point) => ({
    label: point.label,
    value: point.value,
  }));
  const compactValue =
    kpi.format === 'currency'
      ? formatCompactCurrency(kpi.value)
      : formatCompactNumber(kpi.value);

  return (
    <TripledMotionDiv className="h-full min-w-0" variants={tripledFadeInUp}>
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
          <div
            className="mt-auto h-8 w-full opacity-80"
            role="img"
            aria-label={`Tendencia de ${kpi.label}, últimos ${sparklineData.length} meses`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sparklineData}
                margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id={`spark-${kpi.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill={`url(#spark-${kpi.key})`}
                  isAnimationActive={!shouldReduceMotion}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </TripledMotionDiv>
  );
};
