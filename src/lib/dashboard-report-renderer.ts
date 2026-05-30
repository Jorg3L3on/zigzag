import { jsPDF } from 'jspdf';
import type { DashboardReportPayload } from '@/lib/dashboard-report-payload';

const W = 595.2756;
const H = 841.8898;

const COLORS = {
  navy: '#0F172A',
  ink: '#0B1220',
  muted: '#64748B',
  line: '#E2E8F0',
  surface: '#F8FAFC',
  white: '#FFFFFF',
};

type Align = 'left' | 'center' | 'right';

const yTop = (y: number, height = 0): number => H - y - height;
const textY = (y: number): number => H - y;

export function renderDashboardReportPdf(
  payload: DashboardReportPayload,
): ArrayBuffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  const text = (
    value: string,
    x: number,
    y: number,
    size = 10,
    color = COLORS.ink,
    font: 'normal' | 'bold' = 'normal',
    align: Align = 'left',
  ) => {
    doc.setTextColor(color);
    doc.setFont('helvetica', font);
    doc.setFontSize(size);
    doc.text(value, x, textY(y), { align });
  };

  const rr = (
    x: number,
    y: number,
    width: number,
    height: number,
    fill = COLORS.white,
    stroke: string | null = COLORS.line,
  ) => {
    doc.setFillColor(fill);
    if (stroke) {
      doc.setDrawColor(stroke);
      doc.setLineWidth(1);
    }
    doc.roundedRect(x, yTop(y, height), width, height, 10, 10, stroke ? 'FD' : 'F');
  };

  const margin = 42;
  const contentW = W - margin * 2;
  let cursorY = margin + 24;

  doc.setFillColor(COLORS.navy);
  doc.roundedRect(margin, yTop(cursorY, 88), contentW, 88, 14, 14, 'F');
  text(payload.issuer.name, margin + 20, cursorY + 52, 16, COLORS.white, 'bold');
  text(payload.issuer.address, margin + 20, cursorY + 34, 8.5, '#CBD5E1');
  if (payload.issuer.phone) {
    text(`Tel. ${payload.issuer.phone}`, margin + 20, cursorY + 20, 8.5, '#CBD5E1');
  }
  text(payload.title, margin + contentW - 20, cursorY + 52, 14, COLORS.white, 'bold', 'right');
  text(`Periodo: ${payload.periodLabel}`, margin + contentW - 20, cursorY + 34, 9, '#CBD5E1', 'normal', 'right');
  text(payload.generatedAtLabel, margin + contentW - 20, cursorY + 20, 8, '#94A3B8', 'normal', 'right');

  cursorY += 108;

  const kpiW = (contentW - 18) / 2;
  const kpiH = 58;
  payload.kpis.forEach((kpi, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + col * (kpiW + 18);
    const y = cursorY + row * (kpiH + 12);
    rr(x, y, kpiW, kpiH, COLORS.surface, COLORS.line);
    text(kpi.label.toUpperCase(), x + 14, y + kpiH - 18, 7, COLORS.muted, 'bold');
    text(kpi.valueLabel, x + 14, y + kpiH - 36, 12, COLORS.ink, 'bold');
    text(kpi.deltaLabel, x + 14, y + kpiH - 50, 8.5, COLORS.muted);
  });

  cursorY += 2 * (kpiH + 12) + 8;

  const drawSectionTitle = (title: string) => {
    text(title, margin, cursorY, 11, COLORS.ink, 'bold');
    cursorY += 18;
  };

  drawSectionTitle('Ingresos por mes');
  const revenueH = 14 + payload.revenueRows.length * 16;
  rr(margin, cursorY, contentW, Math.min(revenueH, 160), COLORS.white, COLORS.line);
  let rowY = cursorY + revenueH - 12;
  for (const row of payload.revenueRows.slice(-8)) {
    text(row.label, margin + 14, rowY, 9, COLORS.ink);
    text(row.amountLabel, margin + contentW - 14, rowY, 9, COLORS.ink, 'normal', 'right');
    rowY -= 16;
  }
  cursorY += Math.min(revenueH, 160) + 16;

  drawSectionTitle('Estado de cobro');
  const paymentH = 14 + payload.paymentRows.length * 18;
  rr(margin, cursorY, contentW, paymentH, COLORS.white, COLORS.line);
  rowY = cursorY + paymentH - 12;
  for (const row of payload.paymentRows) {
    text(`${row.label} (${row.count})`, margin + 14, rowY, 9, COLORS.ink);
    text(row.amountLabel, margin + contentW - 14, rowY, 9, COLORS.ink, 'normal', 'right');
    rowY -= 18;
  }
  cursorY += paymentH + 16;

  drawSectionTitle('Tickets recientes');
  const ticketRows = payload.recentTicketRows.slice(0, 10);
  const ticketsH = 14 + ticketRows.length * 18;
  rr(margin, cursorY, contentW, Math.min(ticketsH, 220), COLORS.white, COLORS.line);
  rowY = cursorY + Math.min(ticketsH, 220) - 12;
  for (const row of ticketRows) {
    text(row.clientName, margin + 14, rowY, 9, COLORS.ink, 'bold');
    text(`${row.dateLabel} · ${row.statusLabel}`, margin + 14, rowY - 12, 7.5, COLORS.muted);
    text(row.totalLabel, margin + contentW - 14, rowY, 9, COLORS.ink, 'normal', 'right');
    rowY -= 18;
  }

  return doc.output('arraybuffer') as ArrayBuffer;
}
