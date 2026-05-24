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
import { useReducedMotion } from 'framer-motion';

const formatMxCurrency = (value: number) =>
  `$${value.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const RevenueChartDataTable = ({
  rows,
}: {
  rows: RevenueByMonthPoint[];
}) => (
  <table className="sr-only">
    <caption>Ingresos por mes (datos numéricos)</caption>
    <thead>
      <tr>
        <th scope="col">Mes</th>
        <th scope="col">Ingresos</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.monthKey}>
          <td>{row.label}</td>
          <td>{formatMxCurrency(row.revenue)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const ClientSpendChartDataTable = ({
  rows,
}: {
  rows: Array<{ name: string; totalSpent: number }>;
}) => (
  <table className="sr-only">
    <caption>Clientes con mayor gasto (datos numéricos)</caption>
    <thead>
      <tr>
        <th scope="col">Cliente</th>
        <th scope="col">Total gastado</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.name}>
          <td>{row.name}</td>
          <td>{formatMxCurrency(row.totalSpent)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

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
  const shouldReduceMotion = useReducedMotion();
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
          <CardTitle id="dashboard-revenue-chart-title">
            Ingresos por mes
          </CardTitle>
          <CardDescription>
            Tickets finalizados, últimos {revenueMonthCount} meses (fecha de
            ticket o creación)
          </CardDescription>
          <p className="sr-only">
            Los tooltips del gráfico son complementarios. Los montos por mes
            están en la tabla de datos de esta tarjeta y en Ingresos totales.
          </p>
        </CardHeader>
        <CardContent className="flex-1">
          {!hasRevenueData ? (
            <p
              role="status"
              aria-labelledby="dashboard-revenue-chart-title"
              data-testid="dashboard-revenue-chart-empty"
              className="text-sm text-muted-foreground"
            >
              No hay ingresos registrados en este periodo.
            </p>
          ) : (
            <>
            <ChartContainer
              config={revenueChartConfig}
              role="img"
              aria-label={`Gráfica de ingresos por mes, últimos ${revenueMonthCount} meses`}
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
                  isAnimationActive={!shouldReduceMotion}
                />
              </AreaChart>
            </ChartContainer>
            <RevenueChartDataTable rows={revenueByMonth} />
            </>
          )}
        </CardContent>
      </Card>

      <Card
        data-testid={hasClientSpendData ? 'dashboard-clients-chart' : undefined}
        className="flex flex-col"
      >
        <CardHeader>
          <CardTitle id="dashboard-clients-chart-title">
            Clientes con mayor gasto
          </CardTitle>
          <CardDescription>
            Top 8 clientes por total gastado en tickets
          </CardDescription>
          <p className="sr-only">
            Los tooltips del gráfico son complementarios. El detalle por cliente
            está en la sección Métricas de clientes.
          </p>
        </CardHeader>
        <CardContent>
          {!hasClientSpendData ? (
            <p
              role="status"
              aria-labelledby="dashboard-clients-chart-title"
              data-testid="dashboard-clients-chart-empty"
              className="text-sm text-muted-foreground"
            >
              No hay clientes para mostrar.
            </p>
          ) : (
            <>
            <ChartContainer
              config={clientSpendChartConfig}
              role="img"
              aria-label="Gráfica de barras: clientes con mayor gasto, top 8"
              aria-describedby="dashboard-client-metrics"
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
                  isAnimationActive={!shouldReduceMotion}
                />
              </BarChart>
            </ChartContainer>
            <ClientSpendChartDataTable
              rows={topClientsBySpend.map((c) => ({
                name: c.name,
                totalSpent: c.totalSpent,
              }))}
            />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
