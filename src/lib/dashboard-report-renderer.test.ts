import { inflateSync } from 'zlib';
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
      deltaPercent: 12.4,
      sparkline: [
        { monthKey: '2026-05', label: 'may', value: 70 },
        { monthKey: '2026-06', label: 'jun', value: 80 },
        { monthKey: '2026-07', label: 'jul', value: 100 },
      ],
      format: 'currency',
    },
    {
      key: 'cashCollected',
      label: 'Efectivo cobrado',
      value: 80,
      deltaPercent: 8.1,
      sparkline: [
        { monthKey: '2026-05', label: 'may', value: 60 },
        { monthKey: '2026-06', label: 'jun', value: 70 },
        { monthKey: '2026-07', label: 'jul', value: 80 },
      ],
      format: 'currency',
    },
    {
      key: 'outstandingBalance',
      label: 'Saldo por cobrar',
      value: 20,
      deltaPercent: -3.2,
      sparkline: [
        { monthKey: '2026-05', label: 'may', value: 30 },
        { monthKey: '2026-06', label: 'jun', value: 25 },
        { monthKey: '2026-07', label: 'jul', value: 20 },
      ],
      format: 'currency',
    },
    {
      key: 'activeTickets',
      label: 'Tickets activos',
      value: 1,
      deltaPercent: 5,
      sparkline: [
        { monthKey: '2026-05', label: 'may', value: 1 },
        { monthKey: '2026-06', label: 'jun', value: 1 },
        { monthKey: '2026-07', label: 'jul', value: 1 },
      ],
      format: 'number',
    },
  ],
  recentTickets: [
    {
      id: '1',
      clientName: 'Cliente Alpha',
      total: 500,
      paid: 500,
      ticketDate: new Date('2026-07-20T12:00:00Z'),
      createdAt: new Date('2026-07-20T12:00:00Z'),
    },
    {
      id: '2',
      clientName: 'Cliente Beta',
      total: 200,
      paid: 0,
      ticketDate: new Date('2026-07-18T12:00:00Z'),
      createdAt: new Date('2026-07-18T12:00:00Z'),
    },
  ],
  totalTickets: 2,
  totalRevenue: 100,
  totalRevenueRecognized: 100,
  totalCashCollected: 80,
  totalClients: 2,
  totalServices: 1,
  totalServicesSold: 1,
  revenueByMonth: [
    { monthKey: '2026-06', label: 'jun 2026', revenue: 80 },
    { monthKey: '2026-07', label: 'jul 2026', revenue: 100 },
  ],
  paymentStatusBreakdown: [
    { status: 'paid', label: 'Saldado', count: 1, amount: 80 },
    { status: 'partial', label: 'Pago parcial', count: 0, amount: 0 },
    { status: 'pending', label: 'Pendiente', count: 1, amount: 20 },
  ],
  clientMetrics: [],
} satisfies DashboardMetrics;

const unescapePdfString = (value: string): string =>
  value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');

const extractStringsFromContent = (content: string): string[] => {
  const chunks: string[] = [];
  const parenRe = /\((?:\\.|[^\\)])*\)/g;
  let match: RegExpExecArray | null;
  while ((match = parenRe.exec(content)) !== null) {
    const decoded = unescapePdfString(match[0].slice(1, -1));
    if (decoded.trim()) chunks.push(decoded);
  }
  return chunks;
};

const extractPdfText = (buffer: ArrayBuffer): string => {
  const bytes = Buffer.from(buffer);
  const raw = bytes.toString('latin1');
  const chunks: string[] = [];

  // Prefer inflated content streams (compress: true).
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch: RegExpExecArray | null;
  while ((streamMatch = streamRe.exec(raw)) !== null) {
    const payload = Buffer.from(streamMatch[1]!, 'binary');
    try {
      const inflated = inflateSync(payload).toString('latin1');
      chunks.push(...extractStringsFromContent(inflated));
    } catch {
      chunks.push(...extractStringsFromContent(payload.toString('latin1')));
    }
  }

  if (chunks.length === 0) {
    chunks.push(...extractStringsFromContent(raw));
  }

  return chunks.join('\n');
};

describe('renderDashboardReportPdf', () => {
  beforeAll(() => {
    global.TextEncoder = TextEncoder as typeof global.TextEncoder;
    global.TextDecoder = TextDecoder as typeof global.TextDecoder;
  });

  it('returns a valid PDF byte stream', async () => {
    const { renderDashboardReportPdf } = await import(
      '@/lib/dashboard-report-renderer'
    );
    const payload = buildDashboardReportPayload(
      company,
      metrics,
      new Date('2026-07-26T10:30:00'),
    );
    const buffer = renderDashboardReportPdf(payload);
    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(new Uint8Array(buffer).slice(0, 4)).toEqual(
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    );
  });

  it('lays out header before KPIs and sections in reading order', async () => {
    const { renderDashboardReportPdf } = await import(
      '@/lib/dashboard-report-renderer'
    );
    const payload = buildDashboardReportPayload(
      company,
      metrics,
      new Date('2026-07-26T10:30:00'),
    );
    const text = extractPdfText(renderDashboardReportPdf(payload));

    const idx = (needle: string) => {
      const at = text.indexOf(needle);
      expect(at).toBeGreaterThanOrEqual(0);
      return at;
    };

    const header = idx('Resumen del dashboard');
    const kpi = idx('INGRESOS DEL PERIODO');
    const revenue = idx('Ingresos por mes');
    const payment = idx('Estado de cobro');
    const tickets = idx('Tickets recientes');
    const client = idx('Cliente Alpha');

    expect(header).toBeLessThan(kpi);
    expect(kpi).toBeLessThan(revenue);
    expect(revenue).toBeLessThan(payment);
    expect(payment).toBeLessThan(tickets);
    expect(tickets).toBeLessThan(client);
    expect(text).toContain('Cliente Beta');
    expect(text).toContain('+12.4% vs mes anterior');
    expect(text).toContain('-3.2% vs mes anterior');
    expect(text).toContain('RESUMEN');
    expect(text).toContain('Powered by');
    expect(text).toContain('zigzag');
  });

  it('keeps issuer phone once in the header address line', async () => {
    const { renderDashboardReportPdf } = await import(
      '@/lib/dashboard-report-renderer'
    );
    const payload = buildDashboardReportPayload(
      company,
      metrics,
      new Date('2026-07-26T10:30:00'),
    );
    expect(payload.issuer.address).not.toMatch(/Tel\./i);

    const text = extractPdfText(renderDashboardReportPdf(payload));
    const phoneMatches = text.match(/Tel\. 555-0100/g) ?? [];
    expect(phoneMatches.length).toBe(1);
  });

  it('renders valid PDF when issuer logo data is missing or invalid', async () => {
    const { renderDashboardReportPdf } = await import(
      '@/lib/dashboard-report-renderer'
    );
    const payload = buildDashboardReportPayload(
      company,
      metrics,
      new Date('2026-07-26T10:30:00'),
    );

    const withoutLogo = renderDashboardReportPdf(payload, {
      issuerLogoDataUrl: null,
    });
    expect(Buffer.from(withoutLogo).subarray(0, 5).toString('ascii')).toBe(
      '%PDF-',
    );

    const withBadLogo = renderDashboardReportPdf(payload, {
      issuerLogoDataUrl: 'data:text/plain;base64,YQ==',
    });
    expect(Buffer.from(withBadLogo).subarray(0, 5).toString('ascii')).toBe(
      '%PDF-',
    );
  });
});
