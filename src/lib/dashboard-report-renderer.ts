import { jsPDF } from 'jspdf';
import type { DashboardReportPayload } from '@/lib/dashboard-report-payload';

const W = 595.2756;
const H = 841.8898;
const MARGIN = 40;
const CONTENT_W = W - MARGIN * 2;
const GAP = 10;
const FOOTER_RESERVE = 28;

const COLORS = {
  navy: '#0F172A',
  ink: '#0B1220',
  ink2: '#334155',
  muted: '#64748B',
  muted2: '#94A3B8',
  line: '#E2E8F0',
  surface: '#F8FAFC',
  tableHead: '#F1F5F9',
  zebra: '#FAFBFC',
  white: '#FFFFFF',
  positive: '#059669',
  negative: '#DC2626',
};

type Align = 'left' | 'center' | 'right';

/** Y is measured from the bottom of the page (same convention as invoice renderer). */
const yTop = (y: number, height = 0): number => H - y - height;
const textY = (y: number): number => H - y;

const deltaColor = (deltaLabel: string): string => {
  if (deltaLabel.startsWith('+')) return COLORS.positive;
  if (deltaLabel.startsWith('-') && !deltaLabel.startsWith('—')) {
    return COLORS.negative;
  }
  return COLORS.muted;
};

export function renderDashboardReportPdf(
  payload: DashboardReportPayload,
): ArrayBuffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    // Uncompressed streams keep text extractable for unit tests and small reports.
    compress: false,
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

  const measure = (value: string, size: number, font: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', font);
    doc.setFontSize(size);
    return doc.getTextWidth(value);
  };

  const truncateText = (
    value: string,
    maxWidth: number,
    size: number,
    font: 'normal' | 'bold' = 'normal',
  ): string => {
    if (measure(value, size, font) <= maxWidth) return value;
    let next = value;
    while (next.length > 1 && measure(`${next}…`, size, font) > maxWidth) {
      next = next.slice(0, -1);
    }
    return `${next.trimEnd()}…`;
  };

  const rr = (
    x: number,
    y: number,
    width: number,
    height: number,
    fill = COLORS.white,
    stroke: string | null = COLORS.line,
    radius = 8,
  ) => {
    doc.setFillColor(fill);
    if (stroke) {
      doc.setDrawColor(stroke);
      doc.setLineWidth(0.75);
    }
    doc.roundedRect(
      x,
      yTop(y, height),
      width,
      height,
      radius,
      radius,
      stroke ? 'FD' : 'F',
    );
  };

  const fillRow = (x: number, y: number, width: number, height: number) => {
    doc.setFillColor(COLORS.zebra);
    doc.rect(x, yTop(y, height), width, height, 'F');
  };

  doc.setFillColor(COLORS.white);
  doc.rect(0, 0, W, H, 'F');

  // --- Header ---
  const headerH = 78;
  const headerY = H - MARGIN - headerH;
  rr(MARGIN, headerY, CONTENT_W, headerH, COLORS.navy, null, 10);

  text(
    truncateText(payload.issuer.name, CONTENT_W * 0.52, 14, 'bold'),
    MARGIN + 18,
    headerY + headerH - 26,
    14,
    COLORS.white,
    'bold',
  );

  const addressParts = [
    payload.issuer.address,
    payload.issuer.phone ? `Tel. ${payload.issuer.phone}` : '',
  ].filter(Boolean);
  text(
    truncateText(addressParts.join(' · '), CONTENT_W * 0.55, 8),
    MARGIN + 18,
    headerY + headerH - 44,
    8,
    '#CBD5E1',
  );

  text(
    payload.title,
    MARGIN + CONTENT_W - 18,
    headerY + headerH - 26,
    12,
    COLORS.white,
    'bold',
    'right',
  );
  text(
    `Periodo: ${payload.periodLabel}`,
    MARGIN + CONTENT_W - 18,
    headerY + headerH - 44,
    8.5,
    '#CBD5E1',
    'normal',
    'right',
  );
  text(
    payload.generatedAtLabel,
    MARGIN + CONTENT_W - 18,
    headerY + headerH - 58,
    7.5,
    '#94A3B8',
    'normal',
    'right',
  );

  // cursorTop = top edge of free space (from bottom). Content grows downward.
  let cursorTop = headerY - GAP;

  // --- KPI cards ---
  const kpiW = (CONTENT_W - GAP) / 2;
  const kpiH = 58;
  payload.kpis.slice(0, 4).forEach((kpi, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + col * (kpiW + GAP);
    const cardTop = cursorTop - row * (kpiH + GAP);
    const cardY = cardTop - kpiH;

    rr(x, cardY, kpiW, kpiH, COLORS.surface, COLORS.line, 8);
    text(
      truncateText(kpi.label.toUpperCase(), kpiW - 24, 6.5, 'bold'),
      x + 12,
      cardY + kpiH - 14,
      6.5,
      COLORS.muted,
      'bold',
    );
    text(
      truncateText(kpi.valueLabel, kpiW - 24, 13, 'bold'),
      x + 12,
      cardY + kpiH - 32,
      13,
      COLORS.ink,
      'bold',
    );
    text(kpi.deltaLabel, x + 12, cardY + 12, 7.5, deltaColor(kpi.deltaLabel));
  });

  cursorTop -= 2 * (kpiH + GAP) + 4;

  // --- Side-by-side: Ingresos | Estado de cobro ---
  const colW = (CONTENT_W - GAP) / 2;
  const sectionTitleGap = 16;
  const tablePad = 10;
  const headH = 24;
  const bodyRowH = 18;

  const revenueRows = payload.revenueRows.slice(-8);
  const paymentRows = payload.paymentRows;
  const leftRows = Math.max(revenueRows.length, 1);
  const rightRows = Math.max(paymentRows.length, 1);
  const splitRows = Math.max(leftRows, rightRows);
  const splitH = tablePad + headH + splitRows * bodyRowH + 8;
  const splitTop = cursorTop - sectionTitleGap;
  const splitY = splitTop - splitH;

  text('Ingresos por mes', MARGIN, cursorTop - 2, 10, COLORS.ink, 'bold');
  text(
    'Estado de cobro',
    MARGIN + colW + GAP,
    cursorTop - 2,
    10,
    COLORS.ink,
    'bold',
  );

  rr(MARGIN, splitY, colW, splitH, COLORS.white, COLORS.line, 8);
  rr(MARGIN + colW + GAP, splitY, colW, splitH, COLORS.white, COLORS.line, 8);

  const drawTableHead = (x: number, tableTop: number, left: string, right: string) => {
    rr(x + 8, tableTop - headH, colW - 16, headH, COLORS.tableHead, null, 6);
    text(left, x + 16, tableTop - 8, 7, COLORS.muted, 'bold');
    text(right, x + colW - 16, tableTop - 8, 7, COLORS.muted, 'bold', 'right');
  };

  const leftTableTop = splitY + splitH - tablePad;
  const rightTableTop = leftTableTop;
  drawTableHead(MARGIN, leftTableTop, 'Periodo', 'Monto');
  drawTableHead(MARGIN + colW + GAP, rightTableTop, 'Estado', 'Monto');

  if (revenueRows.length === 0) {
    text(
      'Sin datos',
      MARGIN + 16,
      leftTableTop - headH - 12,
      8,
      COLORS.muted,
    );
  } else {
    revenueRows.forEach((row, index) => {
      const baseline = leftTableTop - headH - 12 - index * bodyRowH;
      if (index % 2 === 1) {
        fillRow(MARGIN + 8, baseline - 5, colW - 16, bodyRowH);
      }
      text(
        truncateText(row.label, colW * 0.45, 8),
        MARGIN + 16,
        baseline,
        8,
        COLORS.ink,
      );
      text(
        truncateText(row.amountLabel, colW * 0.42, 8),
        MARGIN + colW - 16,
        baseline,
        8,
        COLORS.ink,
        'normal',
        'right',
      );
    });
  }

  if (paymentRows.length === 0) {
    text(
      'Sin datos',
      MARGIN + colW + GAP + 16,
      rightTableTop - headH - 12,
      8,
      COLORS.muted,
    );
  } else {
    paymentRows.forEach((row, index) => {
      const baseline = rightTableTop - headH - 12 - index * bodyRowH;
      const x0 = MARGIN + colW + GAP;
      if (index % 2 === 1) {
        fillRow(x0 + 8, baseline - 5, colW - 16, bodyRowH);
      }
      text(
        truncateText(`${row.label} (${row.count})`, colW * 0.5, 8),
        x0 + 16,
        baseline,
        8,
        COLORS.ink,
      );
      text(
        truncateText(row.amountLabel, colW * 0.4, 8),
        x0 + colW - 16,
        baseline,
        8,
        COLORS.ink,
        'normal',
        'right',
      );
    });
  }

  cursorTop = splitY - GAP - 2;

  // --- Tickets recientes ---
  const ticketRows = payload.recentTicketRows.slice(0, 10);
  const ticketRowH = 22;
  const ticketHeadH = 24;
  const ticketPad = 10;
  const ticketsTitleGap = 16;
  const available = cursorTop - ticketsTitleGap - (MARGIN + FOOTER_RESERVE);
  const desiredRows = Math.max(ticketRows.length, 1);
  const maxFitRows = Math.max(
    1,
    Math.floor((available - ticketPad - ticketHeadH - 8) / ticketRowH),
  );
  const shownRows = Math.min(desiredRows, maxFitRows);
  const ticketsH = ticketPad + ticketHeadH + shownRows * ticketRowH + 8;
  const ticketsTop = cursorTop - ticketsTitleGap;
  const ticketsY = ticketsTop - ticketsH;

  text('Tickets recientes', MARGIN, cursorTop - 2, 10, COLORS.ink, 'bold');
  if (ticketRows.length > shownRows) {
    text(
      `Mostrando ${shownRows} de ${ticketRows.length}`,
      MARGIN + CONTENT_W,
      cursorTop - 2,
      7.5,
      COLORS.muted2,
      'normal',
      'right',
    );
  }

  rr(MARGIN, ticketsY, CONTENT_W, ticketsH, COLORS.white, COLORS.line, 8);

  const ticketsTableTop = ticketsY + ticketsH - ticketPad;
  rr(
    MARGIN + 8,
    ticketsTableTop - ticketHeadH,
    CONTENT_W - 16,
    ticketHeadH,
    COLORS.tableHead,
    null,
    6,
  );
  text('Cliente', MARGIN + 18, ticketsTableTop - 8, 7, COLORS.muted, 'bold');
  text('Fecha', MARGIN + CONTENT_W * 0.48, ticketsTableTop - 8, 7, COLORS.muted, 'bold');
  text('Estado', MARGIN + CONTENT_W * 0.66, ticketsTableTop - 8, 7, COLORS.muted, 'bold');
  text(
    'Total',
    MARGIN + CONTENT_W - 18,
    ticketsTableTop - 8,
    7,
    COLORS.muted,
    'bold',
    'right',
  );

  if (ticketRows.length === 0) {
    text(
      'Sin tickets recientes',
      MARGIN + 18,
      ticketsTableTop - ticketHeadH - 12,
      8,
      COLORS.muted,
    );
  } else {
    const clientMaxW = CONTENT_W * 0.4 - 20;
    ticketRows.slice(0, shownRows).forEach((row, index) => {
      const baseline = ticketsTableTop - ticketHeadH - 14 - index * ticketRowH;
      if (index % 2 === 1) {
        fillRow(MARGIN + 8, baseline - 6, CONTENT_W - 16, ticketRowH);
      }
      text(
        truncateText(row.clientName, clientMaxW, 8.5, 'bold'),
        MARGIN + 18,
        baseline,
        8.5,
        COLORS.ink,
        'bold',
      );
      text(row.dateLabel, MARGIN + CONTENT_W * 0.48, baseline, 8, COLORS.ink2);
      text(row.statusLabel, MARGIN + CONTENT_W * 0.66, baseline, 8, COLORS.ink2);
      text(
        row.totalLabel,
        MARGIN + CONTENT_W - 18,
        baseline,
        8.5,
        COLORS.ink,
        'normal',
        'right',
      );
    });
  }

  // --- Footer ---
  const footerY = MARGIN - 4;
  doc.setDrawColor(COLORS.line);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, textY(MARGIN + 18), MARGIN + CONTENT_W, textY(MARGIN + 18));
  text('ZigZag · Resumen del dashboard', MARGIN, footerY + 8, 7.5, COLORS.muted2);
  text(
    payload.generatedAtLabel,
    MARGIN + CONTENT_W,
    footerY + 8,
    7.5,
    COLORS.muted2,
    'normal',
    'right',
  );

  return doc.output('arraybuffer') as ArrayBuffer;
}
