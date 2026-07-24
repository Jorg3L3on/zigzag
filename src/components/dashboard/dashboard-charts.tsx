'use client';

import { format, startOfMonth } from 'date-fns';
import { useReducedMotion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DashboardMonthCount,
  RevenueByMonthPoint,
} from '@/lib/dashboard-metrics';
import type { PaymentStatusBreakdownItem } from '@/lib/dashboard-kpi';
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
import { formatCompactCurrency, formatCompactNumber } from '@/lib/format-compact';
import { cn } from '@/lib/utils';

const formatMxCurrency = (value: number) =>
  `$${value.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const RevenueChartDataTable = ({
  rows,
}: {
  rows: RevenueByMonthPoint[];
}) => {
  if (rows.length === 0) {
    return (
      <p role="status" className="sr-only">
        No hay datos de ingresos por mes.
      </p>
    );
  }

  return (
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
};

const PaymentStatusDataTable = ({
  rows,
}: {
  rows: PaymentStatusBreakdownItem[];
}) => {
  if (rows.length === 0) {
    return (
      <p role="status" className="sr-only">
        No hay datos de estado de cobro.
      </p>
    );
  }

  return (
    <table className="sr-only">
      <caption>Estado de cobro de tickets</caption>
      <thead>
        <tr>
          <th scope="col">Estado</th>
          <th scope="col">Tickets</th>
          <th scope="col">Monto</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.status}>
            <td>{row.label}</td>
            <td>{row.count}</td>
            <td>{formatMxCurrency(row.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const revenueChartConfig = {
  revenue: {
    label: 'Ingresos',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

const PAYMENT_CHART_COLORS: Record<
  PaymentStatusBreakdownItem['status'],
  string
> = {
  paid: 'hsl(var(--primary))',
  partial: 'hsl(var(--primary) / 0.8)',
  pending: 'hsl(var(--primary) / 0.6)',
};

export type DashboardChartsProps = {
  revenueByMonth: RevenueByMonthPoint[];
  paymentStatusBreakdown: PaymentStatusBreakdownItem[];
  revenueMonthCount?: DashboardMonthCount;
};

export const DashboardCharts = ({
  revenueByMonth,
  paymentStatusBreakdown,
  revenueMonthCount = 12,
}: DashboardChartsProps) => {
  const shouldReduceMotion = useReducedMotion();
  const hasRevenueData = revenueByMonth.some((m) => m.revenue > 0);
  const currentMonthKey = format(startOfMonth(new Date()), 'yyyy-MM');

  const revenueChartData = revenueByMonth.map((row) => ({
    ...row,
    isCurrentMonth: row.monthKey === currentMonthKey,
  }));

  const hasPaymentData = paymentStatusBreakdown.some(
    (row) => row.count > 0,
  );
  const paymentTotal = paymentStatusBreakdown.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const paymentAmountTotal = paymentStatusBreakdown.reduce(
    (sum, row) => sum + row.amount,
    0,
  );

  return (
    <div className="grid gap-5 sm:gap-4 lg:grid-cols-3">
      <Card
        data-testid={hasRevenueData ? 'dashboard-revenue-chart' : undefined}
        className="flex flex-col lg:col-span-2"
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
            están en la tabla de datos de esta tarjeta.
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
                aria-label={`Gráfica de barras de ingresos por mes, últimos ${revenueMonthCount} meses`}
                className="aspect-auto h-[300px] w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={revenueChartData}
                  margin={{ left: 8, right: 8, top: 8, bottom: 12 }}
                >
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
                      typeof v === 'number' ? formatCompactNumber(v) : `${v}`
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
                  <Bar
                    dataKey="revenue"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={!shouldReduceMotion}
                  >
                    {revenueChartData.map((entry) => (
                      <Cell
                        key={entry.monthKey}
                        fill={
                          entry.isCurrentMonth
                            ? 'hsl(var(--primary))'
                            : 'hsl(var(--primary) / 0.45)'
                        }
                        stroke={
                          entry.isCurrentMonth
                            ? 'hsl(var(--primary))'
                            : 'hsl(var(--primary) / 0.7)'
                        }
                        strokeWidth={entry.isCurrentMonth ? 0 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
              <RevenueChartDataTable rows={revenueByMonth} />
            </>
          )}
        </CardContent>
      </Card>

      <Card
        data-testid={
          hasPaymentData ? 'dashboard-payment-status-chart' : undefined
        }
        className="flex flex-col"
      >
        <CardHeader>
          <CardTitle id="dashboard-payment-status-title">
            Estado de cobro
          </CardTitle>
          <CardDescription>
            Tickets y monto por estado de pago
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          {!hasPaymentData ? (
            <p
              role="status"
              aria-labelledby="dashboard-payment-status-title"
              data-testid="dashboard-payment-status-empty"
              className="text-sm text-muted-foreground"
            >
              No hay tickets para mostrar.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted/40 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Total tickets
                  </p>
                  <p className="text-base font-semibold tabular-nums">
                    {paymentTotal.toLocaleString('es-MX')}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/40 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Monto total
                  </p>
                  <p className="text-base font-semibold tabular-nums">
                    {formatCompactCurrency(paymentAmountTotal)}
                  </p>
                </div>
              </div>
              <div
                className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label="Distribución de tickets por estado de cobro"
              >
                {paymentStatusBreakdown.map((row) => {
                  if (row.count === 0) {
                    return null;
                  }
                  const width = (row.count / paymentTotal) * 100;
                  return (
                    <div
                      key={row.status}
                      className="h-full"
                      style={{
                        width: `${width}%`,
                        backgroundColor: PAYMENT_CHART_COLORS[row.status],
                      }}
                      title={`${row.label}: ${row.count}`}
                    />
                  );
                })}
              </div>
              <ul className="space-y-3 text-sm">
                {paymentStatusBreakdown.map((row) => (
                  <li
                    key={row.status}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn('h-2.5 w-2.5 shrink-0 rounded-full')}
                        style={{
                          backgroundColor: PAYMENT_CHART_COLORS[row.status],
                        }}
                        aria-hidden
                      />
                      <span className="truncate">{row.label}</span>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <span className="font-medium">{row.count}</span>
                      <span
                        className="ml-2 text-muted-foreground"
                        title={formatMxCurrency(row.amount)}
                      >
                        {formatCompactCurrency(row.amount)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <PaymentStatusDataTable rows={paymentStatusBreakdown} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
