import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Company } from '@/db/schema';
import type { DashboardMetrics } from '@/actions/dashboard';
import { invoiceIssuerFromCompany } from '@/components/pdf/invoice-company';
import {
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_LABEL,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';

export type DashboardReportKpi = {
  label: string;
  valueLabel: string;
  deltaLabel: string;
  deltaPercent: number | null;
};

export type DashboardReportPayload = {
  issuer: {
    name: string;
    address: string;
    phone: string;
    currencyCode: string;
  };
  title: string;
  periodLabel: string;
  generatedAtLabel: string;
  kpis: DashboardReportKpi[];
  revenueRows: Array<{ label: string; amount: number; amountLabel: string }>;
  paymentRows: Array<{
    status: TicketPaymentStatus;
    label: string;
    count: number;
    amount: number;
    amountLabel: string;
  }>;
  recentTicketRows: Array<{
    clientName: string;
    totalLabel: string;
    dateLabel: string;
    status: TicketPaymentStatus;
    statusLabel: string;
  }>;
};

const formatDeltaLabel = (deltaPercent: number | null): string => {
  if (deltaPercent === null) {
    return '— vs mes anterior';
  }
  const sign = deltaPercent > 0 ? '+' : '';
  return `${sign}${deltaPercent.toFixed(1)}% vs mes anterior`;
};

const formatMoney = (currencyCode: string, value: number): string =>
  `${currencyCode} ${value.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const buildDashboardReportPayload = (
  company: Company,
  metrics: DashboardMetrics,
  generatedAt: Date = new Date(),
): DashboardReportPayload => {
  const issuerData = invoiceIssuerFromCompany(company);
  const currencyCode = issuerData.currencyCode || 'MXN';
  const issuerName = issuerData.nameLines.join(' ');
  // Prefer one-line street address; phone is a separate field on the PDF header.
  const issuerAddress =
    issuerData.footerAddress ||
    issuerData.detailLines.filter((line) => !/^Tel\./i.test(line)).join(', ');

  const kpis = metrics.kpis.map((kpi) => ({
    label: kpi.label,
    valueLabel:
      kpi.format === 'currency'
        ? formatMoney(currencyCode, kpi.value)
        : kpi.value.toLocaleString('es-MX'),
    deltaLabel: formatDeltaLabel(kpi.deltaPercent),
    deltaPercent: kpi.deltaPercent,
  }));

  return {
    issuer: {
      name: issuerName,
      address: issuerAddress,
      phone: issuerData.footerPhone,
      currencyCode,
    },
    title: 'Resumen del dashboard',
    periodLabel: format(generatedAt, 'MMMM yyyy', { locale: es }),
    generatedAtLabel: format(generatedAt, "d 'de' MMMM yyyy, HH:mm", {
      locale: es,
    }),
    kpis,
    revenueRows: metrics.revenueByMonth.map((row) => ({
      label: row.label,
      amount: row.revenue,
      amountLabel: formatMoney(currencyCode, row.revenue),
    })),
    paymentRows: metrics.paymentStatusBreakdown.map((row) => ({
      status: row.status,
      label: row.label,
      count: row.count,
      amount: row.amount,
      amountLabel: formatMoney(currencyCode, row.amount),
    })),
    recentTicketRows: metrics.recentTickets.map((ticket) => {
      const ref = ticket.ticketDate ?? ticket.createdAt;
      const status = getTicketPaymentStatus(ticket.total, ticket.paid);
      return {
        clientName: ticket.clientName,
        totalLabel: formatMoney(currencyCode, ticket.total ?? 0),
        dateLabel: format(ref, 'd MMM yyyy', { locale: es }),
        status,
        statusLabel: TICKET_PAYMENT_STATUS_LABEL[status],
      };
    }),
  };
};

export const buildDashboardReportFileName = (generatedAt: Date = new Date()): string => {
  const stamp = format(generatedAt, 'yyyy-MM');
  return `dashboard-resumen-${stamp}.pdf`;
};
