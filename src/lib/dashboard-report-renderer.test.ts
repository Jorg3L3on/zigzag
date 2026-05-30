import { TextDecoder, TextEncoder } from 'util';
import { buildDashboardReportPayload } from '@/lib/dashboard-report-payload';
import type { DashboardMetrics } from '@/actions/dashboard';
import type { Company } from '@/db/schema';

const company = {
  id: 1,
  name: 'Empresa Demo',
  phone: '555-0100',
  email: 'demo@example.com',
  logo: null,
  street: 'Calle Principal',
  interior_number: null,
  exterior_number: '100',
  neighborhood: 'Centro',
  city: 'CDMX',
  state: 'CDMX',
  country: 'México',
  postal_code: '01000',
  status: 'ACTIVE' as const,
  settings: { default_currency: 'MXN' },
  created_at: new Date(),
  updated_at: null,
  deleted_at: null,
  is_system: false,
} as Company;

const metrics = {
  kpis: [
    {
      key: 'revenue',
      label: 'Ingresos del periodo',
      value: 100,
      deltaPercent: 0,
      sparkline: [],
      format: 'currency',
    },
    {
      key: 'cashCollected',
      label: 'Efectivo cobrado',
      value: 80,
      deltaPercent: 0,
      sparkline: [],
      format: 'currency',
    },
    {
      key: 'outstandingBalance',
      label: 'Saldo por cobrar',
      value: 20,
      deltaPercent: 0,
      sparkline: [],
      format: 'currency',
    },
    {
      key: 'activeTickets',
      label: 'Tickets activos',
      value: 1,
      deltaPercent: 0,
      sparkline: [],
      format: 'number',
    },
  ],
  recentTickets: [],
  totalTickets: 0,
  totalRevenue: 0,
  totalRevenueRecognized: 0,
  totalCashCollected: 0,
  totalClients: 0,
  totalServices: 0,
  totalServicesSold: 0,
  revenueByMonth: [],
  paymentStatusBreakdown: [
    { status: 'paid', label: 'Saldado', count: 0, amount: 0 },
    { status: 'partial', label: 'Pago parcial', count: 0, amount: 0 },
    { status: 'pending', label: 'Pendiente', count: 0, amount: 0 },
  ],
  clientMetrics: [],
} satisfies DashboardMetrics;

describe('renderDashboardReportPdf', () => {
  it('returns a valid PDF byte stream', async () => {
    global.TextEncoder = TextEncoder as typeof global.TextEncoder;
    global.TextDecoder = TextDecoder as typeof global.TextDecoder;

    const { renderDashboardReportPdf } = await import(
      '@/lib/dashboard-report-renderer'
    );
    const payload = buildDashboardReportPayload(company, metrics);
    const buffer = renderDashboardReportPdf(payload);
    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(new Uint8Array(buffer).slice(0, 4)).toEqual(
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    );
  });
});
