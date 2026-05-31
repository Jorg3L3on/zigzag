'use client';

import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormattedCurrency } from '@/components/formatted-currency';
import { TripledMotionDiv, tripledFadeInUp } from '@/components/tripled/motion';
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
    <TripledMotionDiv className="min-w-0" variants={tripledFadeInUp}>
      <Card className="overflow-hidden border-border/60 bg-gradient-to-b from-card to-card/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-6 sm:pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {kpi.label}
          </CardTitle>
          {icon}
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="space-y-1">
            <p className="text-xl font-semibold tabular-nums leading-none sm:text-2xl">
              {compactValue}
            </p>
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-medium tabular-nums',
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
          </div>
          {kpi.format === 'currency' ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              <FormattedCurrency amount={kpi.value} />
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">vs mes anterior</p>
          <div
            className="h-10 w-full"
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
                      stopOpacity={0.5}
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
                  strokeWidth={1.8}
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
