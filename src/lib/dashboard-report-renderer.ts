import { jsPDF } from 'jspdf';
import type { DashboardReportPayload } from '@/lib/dashboard-report-payload';
import type { TicketPaymentStatus } from '@/lib/ticket-payment-status';

const W = 595.2756;
const H = 841.8898;
const MARGIN = 40;
const CONTENT_W = W - MARGIN * 2;
const GAP = 10;
const FOOTER_RESERVE = 34;

const COLORS = {
  blue: '#2563EB',
  blueSoft: '#EFF4FF',
  blueLine: '#D6E1FF',
  navy: '#0F172A',
  navyDeep: '#111827',
  ink: '#0B1220',
  ink2: '#334155',
  muted: '#64748B',
  muted2: '#94A3B8',
  line: '#E2E8F0',
  surface: '#F8FAFC',
  tableHead: '#EEF4FF',
  zebra: '#F8FAFC',
  white: '#FFFFFF',
  positive: '#059669',
  positiveSoft: '#ECFDF5',
  negative: '#DC2626',
  negativeSoft: '#FEF2F2',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
  dotGrid: '#E8EDF5',
};

const STATUS_STYLE: Record<
  TicketPaymentStatus,
  { fill: string; text: string; bar: string }
> = {
  paid: { fill: COLORS.positiveSoft, text: COLORS.positive, bar: COLORS.positive },
  partial: { fill: COLORS.amberSoft, text: COLORS.amber, bar: COLORS.amber },
  pending: { fill: '#F1F5F9', text: COLORS.ink2, bar: COLORS.muted },
};

type Align = 'left' | 'center' | 'right';

/** Y is measured from the bottom of the page (same convention as invoice renderer). */
const yTop = (y: number, height = 0): number => H - y - height;
const textY = (y: number): number => H - y;

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
    radius = 10,
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

  const shadowCard = (
    x: number,
    y: number,
    width: number,
    height: number,
    fill = COLORS.white,
    stroke = COLORS.blueLine,
  ) => {
    rr(x, y - 2.5, width, height, '#E2E8F0', null, 12);
    rr(x, y, width, height, fill, stroke, 12);
  };

  const statusPill = (
    label: string,
    status: TicketPaymentStatus,
    x: number,
    y: number,
  ) => {
    const style = STATUS_STYLE[status];
    const padX = 7;
    const pillH = 14;
    const labelW = measure(label, 6.5, 'bold');
    const pillW = labelW + padX * 2;
    rr(x, y, pillW, pillH, style.fill, null, 7);
    text(label, x + pillW / 2, y + 4, 6.5, style.text, 'bold', 'center');
    return pillW;
  };

  // Soft page atmosphere (aligned with invoice renderer)
  doc.setFillColor(COLORS.white);
  doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(COLORS.dotGrid);
  for (let x = 16; x < W; x += 18) {
    for (let y = 16; y < H; y += 18) {
      doc.circle(x, y, 0.5, 'F');
    }
  }

  // --- Header ---
  const headerH = 92;
  const headerY = H - MARGIN - headerH;
  shadowCard(MARGIN, headerY, CONTENT_W, headerH, COLORS.navy, null);
  // Accent rail at the top of the header card
  doc.setFillColor(COLORS.blue);
  doc.roundedRect(MARGIN, yTop(headerY + headerH - 5, 5), CONTENT_W, 5, 2, 2, 'F');
  doc.setFillColor(COLORS.navy);
  doc.rect(MARGIN, yTop(headerY + headerH - 5, 5), CONTENT_W, 3, 'F');

  text('RESUMEN', MARGIN + 20, headerY + headerH - 18, 7, '#93C5FD', 'bold');
  text(
    truncateText(payload.issuer.name, CONTENT_W * 0.52, 15, 'bold'),
    MARGIN + 20,
    headerY + headerH - 38,
    15,
    COLORS.white,
    'bold',
  );

  const addressParts = [
    payload.issuer.address,
    payload.issuer.phone ? `Tel. ${payload.issuer.phone}` : '',
  ].filter(Boolean);
  text(
    truncateText(addressParts.join(' · '), CONTENT_W * 0.58, 8),
    MARGIN + 20,
    headerY + headerH - 56,
    8,
    '#CBD5E1',
  );

  text(
    payload.title,
    MARGIN + CONTENT_W - 20,
    headerY + headerH - 28,
    11,
    COLORS.white,
    'bold',
    'right',
  );
  text(
    `Periodo: ${payload.periodLabel}`,
    MARGIN + CONTENT_W - 20,
    headerY + headerH - 46,
    8.5,
    '#BFDBFE',
    'normal',
    'right',
  );
  text(
    payload.generatedAtLabel,
    MARGIN + CONTENT_W - 20,
    headerY + headerH - 62,
    7.5,
    '#94A3B8',
    'normal',
    'right',
  );

  let cursorTop = headerY - GAP - 2;

  // --- KPI cards ---
  const kpiW = (CONTENT_W - GAP) / 2;
  const kpiH = 62;
  payload.kpis.slice(0, 4).forEach((kpi, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + col * (kpiW + GAP);
    const cardTop = cursorTop - row * (kpiH + GAP);
    const cardY = cardTop - kpiH;

    shadowCard(x, cardY, kpiW, kpiH, COLORS.white, COLORS.blueLine);
    // Left accent
    doc.setFillColor(COLORS.blue);
    doc.roundedRect(x, yTop(cardY, kpiH), 4, kpiH, 2, 2, 'F');

    text(
      truncateText(kpi.label.toUpperCase(), kpiW - 28, 6.5, 'bold'),
      x + 16,
      cardY + kpiH - 16,
      6.5,
      COLORS.muted,
      'bold',
    );
    text(
      truncateText(kpi.valueLabel, kpiW - 28, 14, 'bold'),
      x + 16,
      cardY + kpiH - 36,
      14,
      COLORS.ink,
      'bold',
    );

    const delta = kpi.deltaPercent;
    const deltaFill =
      delta === null
        ? COLORS.surface
        : delta > 0
          ? COLORS.positiveSoft
          : delta < 0
            ? COLORS.negativeSoft
            : COLORS.surface;
    const deltaText =
      delta === null
        ? COLORS.muted
        : delta > 0
          ? COLORS.positive
          : delta < 0
            ? COLORS.negative
            : COLORS.muted;
    const deltaW = Math.min(kpiW - 28, measure(kpi.deltaLabel, 7, 'bold') + 14);
    rr(x + 16, cardY + 10, deltaW, 14, deltaFill, null, 7);
    text(kpi.deltaLabel, x + 16 + 7, cardY + 14, 7, deltaText, 'bold');
  });

  cursorTop -= 2 * (kpiH + GAP) + 6;

  // --- Side-by-side: Ingresos (with bars) | Estado de cobro ---
  const colW = (CONTENT_W - GAP) / 2;
  const sectionTitleGap = 18;
  const tablePad = 12;
  const headH = 22;
  const bodyRowH = 26;

  const revenueRows = payload.revenueRows.slice(-8);
  const paymentRows = payload.paymentRows;
  const leftRows = Math.max(revenueRows.length, 1);
  const rightRows = Math.max(paymentRows.length, 1);
  const splitRows = Math.max(leftRows, rightRows);
  const splitH = tablePad + headH + splitRows * bodyRowH + 10;
  const splitY = cursorTop - sectionTitleGap - splitH;

  text('Ingresos por mes', MARGIN, cursorTop - 4, 10.5, COLORS.ink, 'bold');
  text(
    'Estado de cobro',
    MARGIN + colW + GAP,
    cursorTop - 4,
    10.5,
    COLORS.ink,
    'bold',
  );

  shadowCard(MARGIN, splitY, colW, splitH);
  shadowCard(MARGIN + colW + GAP, splitY, colW, splitH);

  const leftTableTop = splitY + splitH - tablePad;
  const rightTableTop = leftTableTop;

  rr(MARGIN + 10, leftTableTop - headH, colW - 20, headH, COLORS.tableHead, null, 6);
  text('Periodo', MARGIN + 18, leftTableTop - 8, 7, COLORS.muted, 'bold');
  text('Monto', MARGIN + colW - 18, leftTableTop - 8, 7, COLORS.muted, 'bold', 'right');

  rr(
    MARGIN + colW + GAP + 10,
    rightTableTop - headH,
    colW - 20,
    headH,
    COLORS.tableHead,
    null,
    6,
  );
  text('Estado', MARGIN + colW + GAP + 18, rightTableTop - 8, 7, COLORS.muted, 'bold');
  text(
    'Monto',
    MARGIN + colW + GAP + colW - 18,
    rightTableTop - 8,
    7,
    COLORS.muted,
    'bold',
    'right',
  );

  const maxRevenue = Math.max(1, ...revenueRows.map((row) => row.amount));
  if (revenueRows.length === 0) {
    text('Sin datos', MARGIN + 18, leftTableTop - headH - 14, 8, COLORS.muted);
  } else {
    revenueRows.forEach((row, index) => {
      const baseline = leftTableTop - headH - 12 - index * bodyRowH;
      const barTrackW = colW - 36;
      const barW = Math.max(3, (row.amount / maxRevenue) * barTrackW);
      text(
        truncateText(row.label, colW * 0.42, 8),
        MARGIN + 18,
        baseline + 6,
        8,
        COLORS.ink,
      );
      text(
        truncateText(row.amountLabel, colW * 0.48, 8, 'bold'),
        MARGIN + colW - 18,
        baseline + 6,
        8,
        COLORS.ink,
        'bold',
        'right',
      );
      doc.setFillColor(COLORS.blueSoft);
      doc.roundedRect(MARGIN + 18, yTop(baseline - 6, 5), barTrackW, 5, 2.5, 2.5, 'F');
      doc.setFillColor(COLORS.blue);
      doc.roundedRect(MARGIN + 18, yTop(baseline - 6, 5), barW, 5, 2.5, 2.5, 'F');
    });
  }

  const maxPayment = Math.max(1, ...paymentRows.map((row) => row.amount));
  if (paymentRows.length === 0) {
    text(
      'Sin datos',
      MARGIN + colW + GAP + 18,
      rightTableTop - headH - 14,
      8,
      COLORS.muted,
    );
  } else {
    paymentRows.forEach((row, index) => {
      const baseline = rightTableTop - headH - 12 - index * bodyRowH;
      const x0 = MARGIN + colW + GAP;
      const style = STATUS_STYLE[row.status];
      doc.setFillColor(style.bar);
      doc.circle(x0 + 22, textY(baseline + 8), 3.2, 'F');
      text(
        truncateText(`${row.label} · ${row.count}`, colW * 0.48, 8, 'bold'),
        x0 + 30,
        baseline + 6,
        8,
        COLORS.ink,
        'bold',
      );
      text(
        truncateText(row.amountLabel, colW * 0.4, 8, 'bold'),
        x0 + colW - 18,
        baseline + 6,
        8,
        COLORS.ink,
        'bold',
        'right',
      );
      const trackW = colW - 48;
      const fillW = Math.max(3, (row.amount / maxPayment) * trackW);
      doc.setFillColor('#F1F5F9');
      doc.roundedRect(x0 + 30, yTop(baseline - 6, 5), trackW, 5, 2.5, 2.5, 'F');
      doc.setFillColor(style.bar);
      doc.roundedRect(x0 + 30, yTop(baseline - 6, 5), fillW, 5, 2.5, 2.5, 'F');
    });
  }

  cursorTop = splitY - GAP - 4;

  // --- Tickets recientes ---
  const ticketRows = payload.recentTicketRows.slice(0, 10);
  const ticketRowH = 24;
  const ticketHeadH = 24;
  const ticketPad = 12;
  const ticketsTitleGap = 18;
  const available = cursorTop - ticketsTitleGap - (MARGIN + FOOTER_RESERVE);
  const desiredRows = Math.max(ticketRows.length, 1);
  const maxFitRows = Math.max(
    1,
    Math.floor((available - ticketPad - ticketHeadH - 8) / ticketRowH),
  );
  const shownRows = Math.min(desiredRows, maxFitRows);
  const ticketsH = ticketPad + ticketHeadH + shownRows * ticketRowH + 8;
  const ticketsY = cursorTop - ticketsTitleGap - ticketsH;

  text('Tickets recientes', MARGIN, cursorTop - 4, 10.5, COLORS.ink, 'bold');
  if (ticketRows.length > shownRows) {
    text(
      `Mostrando ${shownRows} de ${ticketRows.length}`,
      MARGIN + CONTENT_W,
      cursorTop - 4,
      7.5,
      COLORS.muted2,
      'normal',
      'right',
    );
  }

  shadowCard(MARGIN, ticketsY, CONTENT_W, ticketsH);

  const ticketsTableTop = ticketsY + ticketsH - ticketPad;
  rr(
    MARGIN + 10,
    ticketsTableTop - ticketHeadH,
    CONTENT_W - 20,
    ticketHeadH,
    COLORS.tableHead,
    null,
    6,
  );
  text('Cliente', MARGIN + 20, ticketsTableTop - 8, 7, COLORS.muted, 'bold');
  text('Fecha', MARGIN + CONTENT_W * 0.46, ticketsTableTop - 8, 7, COLORS.muted, 'bold');
  text('Estado', MARGIN + CONTENT_W * 0.64, ticketsTableTop - 8, 7, COLORS.muted, 'bold');
  text(
    'Total',
    MARGIN + CONTENT_W - 20,
    ticketsTableTop - 8,
    7,
    COLORS.muted,
    'bold',
    'right',
  );

  if (ticketRows.length === 0) {
    text(
      'Sin tickets recientes',
      MARGIN + 20,
      ticketsTableTop - ticketHeadH - 14,
      8,
      COLORS.muted,
    );
  } else {
    const clientMaxW = CONTENT_W * 0.38 - 16;
    ticketRows.slice(0, shownRows).forEach((row, index) => {
      const baseline = ticketsTableTop - ticketHeadH - 15 - index * ticketRowH;
      if (index % 2 === 1) {
        doc.setFillColor(COLORS.zebra);
        doc.rect(
          MARGIN + 10,
          yTop(baseline - 7, ticketRowH),
          CONTENT_W - 20,
          ticketRowH,
          'F',
        );
      }
      text(
        truncateText(row.clientName, clientMaxW, 8.5, 'bold'),
        MARGIN + 20,
        baseline,
        8.5,
        COLORS.ink,
        'bold',
      );
      text(row.dateLabel, MARGIN + CONTENT_W * 0.46, baseline, 8, COLORS.ink2);
      statusPill(row.statusLabel, row.status, MARGIN + CONTENT_W * 0.64, baseline - 3);
      text(
        row.totalLabel,
        MARGIN + CONTENT_W - 20,
        baseline,
        8.5,
        COLORS.ink,
        'bold',
        'right',
      );
    });
  }

  // --- Footer ---
  doc.setDrawColor(COLORS.line);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, textY(MARGIN + 22), MARGIN + CONTENT_W, textY(MARGIN + 22));
  text('Powered by', MARGIN, MARGIN + 6, 7, COLORS.muted2, 'normal');
  text('zigzag', MARGIN + 42, MARGIN + 6, 7, COLORS.ink2, 'bold');
  doc.setDrawColor(COLORS.ink2);
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 42, textY(MARGIN + 5), MARGIN + 62, textY(MARGIN + 5));
  text(
    payload.generatedAtLabel,
    MARGIN + CONTENT_W,
    MARGIN + 6,
    7,
    COLORS.muted2,
    'normal',
    'right',
  );

  return doc.output('arraybuffer') as ArrayBuffer;
}
