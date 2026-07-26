import { jsPDF } from 'jspdf';
import type { DashboardReportPayload } from '@/lib/dashboard-report-payload';
import type { TicketPaymentStatus } from '@/lib/ticket-payment-status';
import {
  detectPdfImageFormat,
  getCompanyBrandFallbackHue,
  getCompanyBrandInitials,
} from '@/lib/company-logo-branding-shared';

export type DashboardReportRenderOptions = {
  issuerLogoDataUrl?: string | null;
};

const W = 595.2756;
const H = 841.8898;
const MARGIN = 38;
const CONTENT_W = W - MARGIN * 2;
const GAP = 10;
const FOOTER_RESERVE = 32;
const LOGO_SIZE = 52;

const COLORS = {
  blue: '#2563EB',
  blueSoft: '#EFF4FF',
  blueLine: '#D6E1FF',
  blueDeep: '#1D4ED8',
  navy: '#0F172A',
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
type JsPdfWithGraphics = jsPDF & {
  clip: () => jsPDF;
  discardPath: () => jsPDF;
  saveGraphicsState: () => jsPDF;
  restoreGraphicsState: () => jsPDF;
};

/** Y is measured from the bottom of the page (same convention as invoice renderer). */
const yTop = (y: number, height = 0): number => H - y - height;
const textY = (y: number): number => H - y;

const hslToHex = (h: number, s: number, l: number): string => {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export function renderDashboardReportPdf(
  payload: DashboardReportPayload,
  options: DashboardReportRenderOptions = {},
): ArrayBuffer {
  const issuerLogoDataUrl = options.issuerLogoDataUrl ?? null;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  }) as JsPdfWithGraphics;

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
  };

  const drawSparkline = (
    values: number[],
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ) => {
    if (values.length < 2) return;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = Math.max(max - min, 1);
    const step = width / (values.length - 1);
    doc.setDrawColor(color);
    doc.setLineWidth(1.4);
    doc.setLineJoin('round');
    let prevX = x;
    let prevY = y + ((values[0]! - min) / range) * height;
    for (let i = 1; i < values.length; i += 1) {
      const nextX = x + i * step;
      const nextY = y + ((values[i]! - min) / range) * height;
      doc.line(prevX, textY(prevY), nextX, textY(nextY));
      prevX = nextX;
      prevY = nextY;
    }
    // End dot
    doc.setFillColor(color);
    doc.circle(prevX, textY(prevY), 2, 'F');
  };

  const drawLogoPlaceholder = (x: number, y: number, size: number) => {
    const initials = getCompanyBrandInitials(payload.issuer.name);
    const hue = getCompanyBrandFallbackHue(payload.issuer.name);
    const fontSize = initials.length > 1 ? size * 0.36 : size * 0.44;
    const radius = Math.max(6, size * 0.16);
    // Match CompanyBrandAvatar: solid brand tile + white initials (no nested frame).
    doc.setFillColor(hslToHex(hue, 65, 42));
    doc.roundedRect(x, yTop(y, size), size, size, radius, radius, 'F');
    text(
      initials,
      x + size / 2,
      y + size / 2 - fontSize * 0.32,
      fontSize,
      COLORS.white,
      'bold',
      'center',
    );
  };

  const drawIssuerLogo = (x: number, y: number, size = LOGO_SIZE) => {
    const radius = Math.max(6, size * 0.16);

    if (issuerLogoDataUrl) {
      const format = detectPdfImageFormat(issuerLogoDataUrl);
      if (format) {
        try {
          doc.setFillColor(COLORS.white);
          doc.roundedRect(x, yTop(y, size), size, size, radius, radius, 'F');
          doc.saveGraphicsState();
          doc.roundedRect(
            x,
            yTop(y, size),
            size,
            size,
            radius,
            radius,
            null,
          );
          doc.clip();
          doc.addImage(
            issuerLogoDataUrl,
            format,
            x,
            yTop(y, size),
            size,
            size,
            undefined,
            'FAST',
          );
          doc.discardPath();
          doc.restoreGraphicsState();
          return;
        } catch {
          // Fall through to initials placeholder.
        }
      }
    }

    drawLogoPlaceholder(x, y, size);
  };

  // Soft page atmosphere
  doc.setFillColor(COLORS.white);
  doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(COLORS.dotGrid);
  for (let x = 16; x < W; x += 18) {
    for (let y = 16; y < H; y += 18) {
      doc.circle(x, y, 0.45, 'F');
    }
  }

  // --- Header ---
  const headerH = 96;
  const headerY = H - MARGIN - headerH;
  rr(MARGIN, headerY, CONTENT_W, headerH, COLORS.navy, null, 12);

  const logoX = MARGIN + 18;
  const logoY = headerY + (headerH - LOGO_SIZE) / 2;
  drawIssuerLogo(logoX, logoY, LOGO_SIZE);

  const textLeft = logoX + LOGO_SIZE + 14;
  text('RESUMEN', textLeft, headerY + headerH - 22, 7, '#93C5FD', 'bold');
  text(
    truncateText(payload.issuer.name, CONTENT_W * 0.48, 15, 'bold'),
    textLeft,
    headerY + headerH - 42,
    15,
    COLORS.white,
    'bold',
  );
  const addressParts = [
    payload.issuer.address,
    payload.issuer.phone ? `Tel. ${payload.issuer.phone}` : '',
  ].filter(Boolean);
  text(
    truncateText(addressParts.join(' · '), CONTENT_W * 0.5, 7.5),
    textLeft,
    headerY + headerH - 60,
    7.5,
    '#CBD5E1',
  );

  text(
    payload.title,
    MARGIN + CONTENT_W - 18,
    headerY + headerH - 30,
    11,
    COLORS.white,
    'bold',
    'right',
  );
  text(
    `Periodo: ${payload.periodLabel}`,
    MARGIN + CONTENT_W - 18,
    headerY + headerH - 48,
    8.5,
    '#BFDBFE',
    'normal',
    'right',
  );
  text(
    payload.generatedAtLabel,
    MARGIN + CONTENT_W - 18,
    headerY + headerH - 64,
    7.5,
    '#94A3B8',
    'normal',
    'right',
  );

  let cursorTop = headerY - 18;

  // --- KPI cards with sparklines ---
  const kpiW = (CONTENT_W - GAP) / 2;
  const kpiH = 76;
  payload.kpis.slice(0, 4).forEach((kpi, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + col * (kpiW + GAP);
    const cardTop = cursorTop - row * (kpiH + GAP);
    const cardY = cardTop - kpiH;

    rr(x, cardY, kpiW, kpiH, COLORS.white, COLORS.line, 10);

    // Top → label, value, delta chip. Extra top pad avoids a cramped first-card look.
    text(
      truncateText(kpi.label.toUpperCase(), kpiW - 90, 6.5, 'bold'),
      x + 14,
      cardY + kpiH - 20,
      6.5,
      COLORS.muted,
      'bold',
    );
    text(
      truncateText(kpi.valueLabel, kpiW - 90, 14, 'bold'),
      x + 14,
      cardY + kpiH - 42,
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
    const deltaW = Math.min(kpiW - 28, measure(kpi.deltaLabel, 6.5, 'bold') + 12);
    rr(x + 14, cardY + 12, deltaW, 14, deltaFill, null, 7);
    text(kpi.deltaLabel, x + 14 + 6, cardY + 16, 6.5, deltaText, 'bold');

    const sparkColor =
      delta !== null && delta < 0 ? COLORS.negative : COLORS.blue;
    drawSparkline(kpi.sparkline, x + kpiW - 78, cardY + 30, 58, 24, sparkColor);
  });

  cursorTop -= 2 * (kpiH + GAP) + 4;

  // --- Revenue vertical bar chart (full width) ---
  const revenueRows = payload.revenueRows.slice(-8);
  const chartH = 148;
  const chartTitleGap = 16;
  const chartY = cursorTop - chartTitleGap - chartH;
  text('Ingresos por mes', MARGIN, cursorTop - 3, 10.5, COLORS.ink, 'bold');
  if (revenueRows.length > 0) {
    const latest = revenueRows[revenueRows.length - 1]!;
    text(
      latest.amountLabel,
      MARGIN + CONTENT_W,
      cursorTop - 3,
      9,
      COLORS.ink2,
      'bold',
      'right',
    );
  }
  shadowCard(MARGIN, chartY, CONTENT_W, chartH);

  const plotPadX = 36;
  const plotPadTop = 18;
  const plotPadBottom = 28;
  const plotX = MARGIN + plotPadX;
  const plotW = CONTENT_W - plotPadX * 2;
  const plotBottom = chartY + plotPadBottom;
  const plotTop = chartY + chartH - plotPadTop;
  const plotH = plotTop - plotBottom;
  const maxRevenue = Math.max(1, ...revenueRows.map((row) => row.amount));

  // Horizontal guide lines
  for (let g = 0; g <= 3; g += 1) {
    const gy = plotBottom + (plotH * g) / 3;
    doc.setDrawColor(COLORS.line);
    doc.setLineWidth(0.5);
    doc.line(plotX, textY(gy), plotX + plotW, textY(gy));
    const guideValue = (maxRevenue * g) / 3;
    text(
      guideValue >= 1000
        ? `${(guideValue / 1000).toFixed(g === 0 ? 0 : 1)}k`
        : guideValue.toFixed(0),
      plotX - 6,
      gy - 2,
      6,
      COLORS.muted2,
      'normal',
      'right',
    );
  }

  if (revenueRows.length === 0) {
    text('Sin datos de ingresos', MARGIN + CONTENT_W / 2, chartY + chartH / 2, 9, COLORS.muted, 'normal', 'center');
  } else {
    const slotW = plotW / revenueRows.length;
    const barW = Math.min(28, slotW * 0.55);
    revenueRows.forEach((row, index) => {
      const centerX = plotX + slotW * index + slotW / 2;
      const barH = Math.max(3, (row.amount / maxRevenue) * plotH);
      const barX = centerX - barW / 2;
      const barY = plotBottom;
      const isLast = index === revenueRows.length - 1;
      doc.setFillColor(isLast ? COLORS.blue : COLORS.blueSoft);
      doc.roundedRect(barX, yTop(barY, barH), barW, barH, 4, 4, 'F');
      if (isLast) {
        doc.setFillColor(COLORS.blueDeep);
        doc.roundedRect(barX, yTop(barY + barH - 4, 4), barW, 4, 2, 2, 'F');
      }
      text(
        row.shortLabel,
        centerX,
        chartY + 10,
        7,
        isLast ? COLORS.ink : COLORS.muted,
        isLast ? 'bold' : 'normal',
        'center',
      );
    });
  }

  cursorTop = chartY - GAP - 2;

  // --- Payment status: stacked bar + detail cards ---
  const paymentRows = payload.paymentRows;
  const paymentH = 86;
  const paymentTitleGap = 16;
  const paymentY = cursorTop - paymentTitleGap - paymentH;
  text('Estado de cobro', MARGIN, cursorTop - 3, 10.5, COLORS.ink, 'bold');
  shadowCard(MARGIN, paymentY, CONTENT_W, paymentH);

  const totalPaymentAmount = paymentRows.reduce((sum, row) => sum + row.amount, 0);
  const stackX = MARGIN + 18;
  const stackY = paymentY + paymentH - 28;
  const stackW = CONTENT_W - 36;
  const stackH = 12;
  doc.setFillColor('#F1F5F9');
  doc.roundedRect(stackX, yTop(stackY, stackH), stackW, stackH, 6, 6, 'F');

  if (totalPaymentAmount > 0) {
    let cursorX = stackX;
    paymentRows.forEach((row) => {
      const segW = (row.amount / totalPaymentAmount) * stackW;
      if (segW <= 0) return;
      doc.setFillColor(STATUS_STYLE[row.status].bar);
      doc.roundedRect(cursorX, yTop(stackY, stackH), Math.max(segW, 2), stackH, 4, 4, 'F');
      cursorX += segW;
    });
  }

  const cardGap = 8;
  const statusCardW = (CONTENT_W - 36 - cardGap * 2) / 3;
  paymentRows.slice(0, 3).forEach((row, index) => {
    const x = MARGIN + 18 + index * (statusCardW + cardGap);
    const y = paymentY + 14;
    const style = STATUS_STYLE[row.status];
    rr(x, y, statusCardW, 40, style.fill, null, 8);
    doc.setFillColor(style.bar);
    doc.circle(x + 12, textY(y + 28), 3.2, 'F');
    text(row.label, x + 20, y + 26, 7.5, style.text, 'bold');
    text(`${row.count} tickets`, x + 20, y + 12, 6.5, COLORS.muted);
    text(
      truncateText(row.amountLabel, statusCardW - 16, 8, 'bold'),
      x + statusCardW - 8,
      y + 18,
      8,
      COLORS.ink,
      'bold',
      'right',
    );
  });
  if (paymentRows.length === 0) {
    text('Sin desglose de cobro', MARGIN + CONTENT_W / 2, paymentY + paymentH / 2, 8, COLORS.muted, 'normal', 'center');
  }

  cursorTop = paymentY - GAP - 2;

  // --- Tickets recientes ---
  const ticketRows = payload.recentTicketRows.slice(0, 10);
  const ticketRowH = 23;
  const ticketHeadH = 22;
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
  const ticketsY = cursorTop - ticketsTitleGap - ticketsH;

  text('Tickets recientes', MARGIN, cursorTop - 3, 10.5, COLORS.ink, 'bold');
  if (ticketRows.length > shownRows) {
    text(
      `Mostrando ${shownRows} de ${ticketRows.length}`,
      MARGIN + CONTENT_W,
      cursorTop - 3,
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
  text('Cliente', MARGIN + 18, ticketsTableTop - 8, 7, COLORS.muted, 'bold');
  text('Fecha', MARGIN + CONTENT_W * 0.46, ticketsTableTop - 8, 7, COLORS.muted, 'bold');
  text('Estado', MARGIN + CONTENT_W * 0.64, ticketsTableTop - 8, 7, COLORS.muted, 'bold');
  text('Total', MARGIN + CONTENT_W - 18, ticketsTableTop - 8, 7, COLORS.muted, 'bold', 'right');

  if (ticketRows.length === 0) {
    text(
      'Sin tickets recientes',
      MARGIN + 18,
      ticketsTableTop - ticketHeadH - 12,
      8,
      COLORS.muted,
    );
  } else {
    const clientMaxW = CONTENT_W * 0.38 - 14;
    ticketRows.slice(0, shownRows).forEach((row, index) => {
      const baseline = ticketsTableTop - ticketHeadH - 14 - index * ticketRowH;
      if (index % 2 === 1) {
        doc.setFillColor(COLORS.zebra);
        doc.rect(
          MARGIN + 10,
          yTop(baseline - 6, ticketRowH),
          CONTENT_W - 20,
          ticketRowH,
          'F',
        );
      }
      text(
        truncateText(row.clientName, clientMaxW, 8.5, 'bold'),
        MARGIN + 18,
        baseline,
        8.5,
        COLORS.ink,
        'bold',
      );
      text(row.dateLabel, MARGIN + CONTENT_W * 0.46, baseline, 8, COLORS.ink2);
      statusPill(row.statusLabel, row.status, MARGIN + CONTENT_W * 0.64, baseline - 3);
      text(
        row.totalLabel,
        MARGIN + CONTENT_W - 18,
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
  doc.line(MARGIN, textY(MARGIN + 20), MARGIN + CONTENT_W, textY(MARGIN + 20));
  text('Powered by', MARGIN, MARGIN + 5, 7, COLORS.muted2);
  text('zigzag', MARGIN + 42, MARGIN + 5, 7, COLORS.ink2, 'bold');
  doc.setDrawColor(COLORS.ink2);
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 42, textY(MARGIN + 4), MARGIN + 62, textY(MARGIN + 4));
  text(
    payload.generatedAtLabel,
    MARGIN + CONTENT_W,
    MARGIN + 5,
    7,
    COLORS.muted2,
    'normal',
    'right',
  );

  return doc.output('arraybuffer') as ArrayBuffer;
}
