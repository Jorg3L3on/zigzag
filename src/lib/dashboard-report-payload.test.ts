import type { DashboardMetrics } from '@/actions/dashboard';
import type { Company } from '@/db/schema';
import { buildDashboardReportPayload } from '@/lib/dashboard-report-payload';

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
};

const metrics: DashboardMetrics = {
  kpis: [
    {
      key: 'revenue',
      label: 'Ingresos del periodo',
      value: 1000,
      deltaPercent: 10,
      sparkline: [],
      format: 'currency',
    },
    {
      key: 'cashCollected',
      label: 'Efectivo cobrado',
      value: 800,
      deltaPercent: 5,
      sparkline: [],
      format: 'currency',
    },
    {
      key: 'outstandingBalance',
      label: 'Saldo por cobrar',
      value: 200,
      deltaPercent: -5,
      sparkline: [],
      format: 'currency',
    },
    {
      key: 'activeTickets',
      label: 'Tickets activos',
      value: 3,
      deltaPercent: 0,
      sparkline: [],
      format: 'number',
    },
  ],
  recentTickets: [
    {
      id: '1',
      clientName: 'Cliente A',
      total: 500,
      paid: 0,
      ticketDate: new Date(2026, 4, 10),
      createdAt: new Date(2026, 4, 10),
    },
  ],
  totalTickets: 1,
  totalRevenue: 1000,
  totalRevenueRecognized: 1000,
  totalCashCollected: 800,
  totalClients: 1,
  totalServices: 1,
  totalServicesSold: 1,
  revenueByMonth: [{ monthKey: '2026-05', label: 'may 2026', revenue: 1000 }],
  paymentStatusBreakdown: [
    { status: 'pending', label: 'Pendiente', count: 1, amount: 500 },
    { status: 'paid', label: 'Saldado', count: 0, amount: 0 },
    { status: 'partial', label: 'Pago parcial', count: 0, amount: 0 },
  ],
  clientMetrics: [],
};

describe('buildDashboardReportPayload', () => {
  it('maps metrics to report labels', () => {
    const payload = buildDashboardReportPayload(
      company as Company,
      metrics,
      new Date(2026, 4, 15),
    );
    expect(payload.title).toBe('Resumen del dashboard');
    expect(payload.kpis).toHaveLength(4);
    expect(payload.kpis[0].valueLabel).toContain('MXN');
    expect(payload.recentTicketRows[0].clientName).toBe('Cliente A');
    expect(payload.periodLabel).toMatch(/mayo/i);
  });
});
