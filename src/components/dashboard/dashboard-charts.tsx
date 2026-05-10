'use client';

import type {
  DashboardMonthCount,
  RevenueByMonthPoint,
} from '@/lib/dashboard-metrics';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

const formatMxCurrency = (value: number) =>
  `$${value.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const revenueChartConfig = {
  revenue: {
    label: 'Ingresos',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

const clientSpendChartConfig = {
  totalSpent: {
    label: 'Total gastado',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

export type ClientMetricRow = {
  id: number;
  name: string;
  ticketCount: number;
  totalSpent: number;
};

export type DashboardChartsProps = {
  revenueByMonth: RevenueByMonthPoint[];
  clientMetrics: ClientMetricRow[];
  revenueMonthCount?: DashboardMonthCount;
};

export const DashboardCharts = ({
  revenueByMonth,
  clientMetrics,
  revenueMonthCount = 12,
}: DashboardChartsProps) => {
  const hasRevenueData = revenueByMonth.some((m) => m.revenue > 0);

  const topClientsBySpend = [...clientMetrics]
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 8)
    .map((c) => ({
      ...c,
      displayName:
        c.name.length > 28 ? `${c.name.slice(0, 26).trimEnd()}…` : c.name,
    }));

  const hasClientSpendData = topClientsBySpend.length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card
        data-testid={hasRevenueData ? 'dashboard-revenue-chart' : undefined}
        className="flex flex-col"
      >
        <CardHeader>
          <CardTitle>Ingresos por mes</CardTitle>
          <CardDescription>
            Tickets finalizados, últimos {revenueMonthCount} meses (fecha de
            ticket o creación)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          {!hasRevenueData ? (
            <p className="text-sm text-muted-foreground">
              No hay ingresos registrados en este periodo.
            </p>
          ) : (
            <ChartContainer
              config={revenueChartConfig}
              className="aspect-auto h-[280px] w-full"
            >
              <AreaChart
                accessibilityLayer
                data={revenueByMonth}
                margin={{ left: 8, right: 8, top: 8, bottom: 12 }}
              >
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-revenue)"
                      stopOpacity={0.85}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-revenue)"
                      stopOpacity={0.08}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={68}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v) =>
                    typeof v === 'number'
                      ? v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1000
                          ? `${(v / 1000).toFixed(1)}k`
                          : `${v}`
                      : `${v}`
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="font-medium tabular-nums">
                          {typeof value === 'number'
                            ? formatMxCurrency(value)
                            : value}
                        </span>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  fill="url(#fillRevenue)"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                  isAnimationActive
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card
        data-testid={hasClientSpendData ? 'dashboard-clients-chart' : undefined}
        className="flex flex-col"
      >
        <CardHeader>
          <CardTitle>Clientes con mayor gasto</CardTitle>
          <CardDescription>
            Top 8 clientes por total gastado en tickets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasClientSpendData ? (
            <p className="text-sm text-muted-foreground">
              No hay clientes para mostrar.
            </p>
          ) : (
            <ChartContainer
              config={clientSpendChartConfig}
              className="aspect-auto h-[min(360px,70vh)] w-full"
            >
              <BarChart
                accessibilityLayer
                data={topClientsBySpend}
                layout="vertical"
                margin={{ left: 4, right: 16, top: 8, bottom: 8 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    typeof v === 'number' ? formatMxCurrency(v) : `${v}`
                  }
                />
                <YAxis
                  type="category"
                  dataKey="displayName"
                  width={120}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="font-medium tabular-nums">
                          {typeof value === 'number'
                            ? formatMxCurrency(value)
                            : value}
                        </span>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="totalSpent"
                  fill="var(--color-totalSpent)"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
