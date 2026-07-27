import { jsPDF } from 'jspdf';
import type {
  FintechInvoiceItem,
  FintechInvoicePayload,
} from '@/lib/fintech-invoice-payload';
import { detectPdfImageFormat } from '@/lib/company-logo-branding-shared';

export type FintechInvoiceRenderOptions = {
  issuerLogoDataUrl?: string | null;
};

const W = 595.2756;
const H = 841.8898;
const MAIN_PAGE_MAX_ROWS = 6;
const CONTINUATION_PAGE_MAX_ROWS = 12;
const ROW_STEP = 42;
const TABLE_HEADER_H = 34;
const TYPOGRAPHY_SCALE = 0.82;
const ICON_SCALE = 0.82;
const HEADER_H = 78;
const ISSUER_LOGO_PLATE = 48;

const COLORS = {
  blue: '#2563EB',
  purple: '#7C3AED',
  navy: '#0F172A',
  navyDeep: '#111827',
  ink: '#0B1220',
  ink2: '#334155',
  muted: '#64748B',
  muted2: '#94A3B8',
  line: '#E2E8F0',
  lineBlue: '#D6E1FF',
  surface: '#F8FAFC',
  surfaceBlue: '#F1F5FF',
  tableHead: '#EEF4FF',
  green: '#10B981',
  greenSoft: '#EAFDF4',
  amber: '#F59E0B',
  white: '#FFFFFF',
  dotGrid: '#E8EDF5',
};

type Align = 'left' | 'center' | 'right';
type JsPdfWithGraphics = jsPDF & {
  clip: () => jsPDF;
  discardPath: () => jsPDF;
  saveGraphicsState: () => jsPDF;
  restoreGraphicsState: () => jsPDF;
};

type ServiceTableLayout = {
  serviceX: number;
  serviceW: number;
  qtyX: number;
  priceRightX: number;
  amountRightX: number;
};

const yTop = (y: number, height = 0): number => H - y - height;
const textY = (y: number): number => H - y;

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
};

const mixColor = (from: string, to: string, t: number): string => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const parts = a.map((value, index) =>
    Math.round(value + (b[index] - value) * t)
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${parts.join('')}`;
};

const money = (currencyCode: string, value: number): string =>
  `${currencyCode} ${value.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const serviceTableLayout = (margin: number, contentW: number): ServiceTableLayout => ({
  serviceX: margin + 22,
  serviceW: 196,
  qtyX: margin + contentW - 238,
  priceRightX: margin + contentW - 108,
  amountRightX: margin + contentW - 18,
});

export function renderFintechInvoicePdf(
  payload: FintechInvoicePayload,
  options: FintechInvoiceRenderOptions = {},
): ArrayBuffer {
  const issuerLogoDataUrl = options.issuerLogoDataUrl ?? null;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  }) as JsPdfWithGraphics;

  const currencyCode = payload.issuer.currencyCode;
  const isPaid = payload.balanceDue <= 0;

  const setFill = (color: string) => doc.setFillColor(color);
  const setStroke = (color: string) => doc.setDrawColor(color);

  const text = (
    value: string,
    x: number,
    y: number,
    size = 10,
    color = COLORS.ink,
    font: 'normal' | 'bold' = 'normal',
    align: Align = 'left',
    maxWidth?: number,
  ) => {
    doc.setTextColor(color);
    doc.setFont('helvetica', font);
    doc.setFontSize(size * TYPOGRAPHY_SCALE);
    const normalized = maxWidth ? truncateText(value, maxWidth) : value;
    doc.text(normalized, x, textY(y), { align });
  };

  const truncateText = (value: string, maxWidth: number): string => {
    if (doc.getTextWidth(value) <= maxWidth) return value;
    let next = value;
    while (next.length > 1 && doc.getTextWidth(`${next}...`) > maxWidth) {
      next = next.slice(0, -1);
    }
    return `${next.trimEnd()}...`;
  };

  const label = (value: string, x: number, y: number, color = COLORS.muted) => {
    text(value.toUpperCase(), x, y, 6.5, color, 'bold');
  };

  const rr = (
    x: number,
    y: number,
    width: number,
    height: number,
    radius = 12,
    fill = COLORS.white,
    stroke: string | null = COLORS.line,
    lineWidth = 1,
  ) => {
    if (fill) setFill(fill);
    if (stroke) {
      setStroke(stroke);
      doc.setLineWidth(lineWidth);
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
    radius = 16,
    fill = COLORS.white,
    stroke = COLORS.lineBlue,
  ) => {
    rr(x, y - 3, width, height, radius, '#CBD5E1', null);
    rr(x, y, width, height, radius, fill, stroke, 0.75);
  };

  const gradientRect = (
    x: number,
    y: number,
    width: number,
    height: number,
    radius = 12,
    start = COLORS.blue,
    end = COLORS.purple,
  ) => {
    setFill(start);
    doc.roundedRect(x, yTop(y, height), width, height, radius, radius, 'F');
    setFill(end);
    doc.roundedRect(
      x + width / 2,
      yTop(y, height),
      width / 2,
      height,
      radius,
      radius,
      'F',
    );
    const inset = Math.min(radius, width / 2);
    const gradientX = x + inset;
    const gradientWidth = Math.max(0, width - inset * 2);
    const slices = Math.max(24, Math.ceil(width / 4));
    const sliceWidth = gradientWidth / slices;
    for (let index = 0; index < slices; index += 1) {
      const t = slices === 1 ? 0 : index / (slices - 1);
      setFill(mixColor(start, end, t));
      doc.rect(
        gradientX + index * sliceWidth,
        yTop(y, height),
        sliceWidth + 0.75,
        height,
        'F',
      );
    }
  };

  const drawLogoPlaceholder = (x: number, y: number, size = 34) => {
    gradientRect(x, y, size, size, Math.max(6, size * 0.22));
    doc.setDrawColor(COLORS.white);
    doc.setLineWidth(Math.max(1.8, size * 0.07));
    const top = yTop(y, size);
    doc.lines(
      [
        [size * 0.15, size * 0.23],
        [size * 0.15, -size * 0.24],
        [size * 0.2, size * 0.29],
      ],
      x + size * 0.24,
      top + size * 0.4,
    );
  };

  const drawIssuerLogo = (
    x: number,
    y: number,
    size = ISSUER_LOGO_PLATE,
  ) => {
    const corner = size / 2;
    const ring = 2.2;
    const imageSize = size - ring * 2;
    const imageX = x + ring;
    const imageY = y + ring;

    // Layered circular badge: indigo shadow, white ring plate, logo disc.
    rr(x + 2, y - 2.8, size, size, corner, '#312E81', null);
    rr(x, y, size, size, corner, COLORS.white, null);
    setStroke('#C7D2FE');
    doc.setLineWidth(1.5);
    doc.roundedRect(x, yTop(y, size), size, size, corner, corner, 'S');

    if (issuerLogoDataUrl) {
      const format = detectPdfImageFormat(issuerLogoDataUrl);
      if (format) {
        try {
          doc.addImage(
            issuerLogoDataUrl,
            format,
            imageX,
            yTop(imageY, imageSize),
            imageSize,
            imageSize,
            undefined,
            'FAST',
          );
          return;
        } catch {
          // Fall back to vector placeholder when image data is invalid.
        }
      }
    }

    drawLogoPlaceholder(imageX, imageY, imageSize);
  };

  const wrapText = (
    value: string,
    x: number,
    y: number,
    width: number,
    size: number,
    color: string,
    font: 'normal' | 'bold' = 'normal',
    lineHeight = size + 3,
    maxLines = 2,
    align: Align = 'left',
  ) => {
    doc.setTextColor(color);
    doc.setFont('helvetica', font);
    const scaledSize = size * TYPOGRAPHY_SCALE;
    const scaledLineHeight = lineHeight * TYPOGRAPHY_SCALE;
    doc.setFontSize(scaledSize);
    const allLines = doc.splitTextToSize(value, width) as string[];
    const lines = allLines.slice(0, maxLines);
    lines.forEach((line, index) => {
      const suffix =
        index === maxLines - 1 && allLines.length > maxLines
          ? truncateText(line, width)
          : line;
      doc.text(suffix, x, textY(y - index * scaledLineHeight), { align });
    });
  };

  const countWrappedLines = (
    value: string,
    width: number,
    size: number,
    font: 'normal' | 'bold',
    maxLines: number,
  ): number => {
    doc.setFont('helvetica', font);
    doc.setFontSize(size * TYPOGRAPHY_SCALE);
    return Math.min(maxLines, (doc.splitTextToSize(value, width) as string[]).length);
  };

  const drawBackground = () => {
    setFill(COLORS.white);
    doc.rect(0, 0, W, H, 'F');
    setFill(COLORS.dotGrid);
    const spacing = 18;
    for (let x = spacing; x < W; x += spacing) {
      for (let y = spacing; y < H; y += spacing) {
        doc.circle(x, y, 0.55, 'F');
      }
    }
  };

  const drawFooter = () => {
    const margin = 42;
    const contentW = W - 2 * margin;
    const dividerY = 120;
    const colWidth = contentW / 3;
    const iconY = 96;
    const labelY = 78;
    const valueY = 66;

    setStroke(COLORS.line);
    doc.setLineWidth(0.8);
    doc.line(margin, textY(dividerY), margin + contentW, textY(dividerY));

    const drawFooterIcon = (
      kind: 'phone' | 'email' | 'address',
      centerX: number,
      y: number,
    ) => {
      const iconScale = ICON_SCALE;
      setStroke(COLORS.blue);
      doc.setLineWidth(1.2);
      if (kind === 'phone') {
        doc.roundedRect(
          centerX - 5 * iconScale,
          textY(y + 8 * iconScale),
          10 * iconScale,
          16 * iconScale,
          2 * iconScale,
          2 * iconScale,
          'S',
        );
        doc.line(
          centerX - 2 * iconScale,
          textY(y - 5 * iconScale),
          centerX + 2 * iconScale,
          textY(y - 5 * iconScale),
        );
        return;
      }

      if (kind === 'email') {
        doc.roundedRect(
          centerX - 8 * iconScale,
          textY(y + 6 * iconScale),
          16 * iconScale,
          11 * iconScale,
          2 * iconScale,
          2 * iconScale,
          'S',
        );
        doc.line(
          centerX - 8 * iconScale,
          textY(y + 6 * iconScale),
          centerX,
          textY(y - iconScale),
        );
        doc.line(
          centerX + 8 * iconScale,
          textY(y + 6 * iconScale),
          centerX,
          textY(y - iconScale),
        );
        return;
      }

      // Location pin: filled head + triangular stem.
      setFill(COLORS.blue);
      doc.circle(centerX, textY(y + 3 * iconScale), 5.5 * iconScale, 'F');
      setFill(COLORS.white);
      doc.circle(centerX, textY(y + 3 * iconScale), 2.2 * iconScale, 'F');
      setFill(COLORS.blue);
      doc.triangle(
        centerX - 4.5 * iconScale,
        textY(y + 1 * iconScale),
        centerX + 4.5 * iconScale,
        textY(y + 1 * iconScale),
        centerX,
        textY(y - 8 * iconScale),
        'F',
      );
    };

    const contacts: Array<['phone' | 'email' | 'address', string, string]> = [
      ['phone', 'TELÉFONO', payload.issuer.phone || 'Sin teléfono'],
      ['email', 'CORREO', payload.issuer.email || 'Sin correo'],
      ['address', 'DIRECCIÓN', payload.issuer.footerAddress || payload.issuer.address],
    ];

    contacts.forEach(([kind, title, value], index) => {
      const centerX = margin + colWidth * index + colWidth / 2;
      drawFooterIcon(kind, centerX, iconY);
      text(title, centerX, labelY, 6.5, COLORS.ink2, 'bold', 'center');
      wrapText(
        value,
        centerX,
        valueY,
        colWidth - 24,
        6.5,
        COLORS.muted,
        'normal',
        8,
        3,
        'center',
      );
    });

    text('Powered by', W / 2 - 15, 28, 6.5, COLORS.muted2, 'normal', 'right');
    text('zigzag', W / 2 - 11, 28, 6.5, COLORS.ink2, 'bold');
    setStroke(COLORS.ink2);
    doc.setLineWidth(0.4);
    doc.line(W / 2 - 11, textY(27), W / 2 + 10, textY(27));
  };

  const drawServiceRows = (
    items: FintechInvoiceItem[],
    firstRowY: number,
    contentW: number,
    margin: number,
    maxRows: number,
  ) => {
    const layout = serviceTableLayout(margin, contentW);
    const nameSize = 10.5;
    const nameLineHeight = 12;
    const descSize = 7.5;
    const descLineHeight = 9;
    const visibleItems = items.slice(0, maxRows);

    visibleItems.forEach((item, index) => {
      const rowTop = firstRowY - index * ROW_STEP;
      const rowCenter = rowTop - ROW_STEP / 2 + 2;
      const isLastRow = index === visibleItems.length - 1;

      // Keep clear padding between row content and the separator.
      if (!isLastRow) {
        const dividerY = rowTop - ROW_STEP + 10;
        setStroke('#EEF2F7');
        doc.setLineWidth(0.8);
        doc.line(margin + 18, textY(dividerY), margin + contentW - 18, textY(dividerY));
      }

      const nameLineCount = countWrappedLines(
        item.name,
        layout.serviceW,
        nameSize,
        'bold',
        2,
      );
      const nameBaseline = rowTop - 12;
      wrapText(
        item.name,
        layout.serviceX,
        nameBaseline,
        layout.serviceW,
        nameSize,
        COLORS.ink,
        'bold',
        nameLineHeight,
        2,
      );

      if (item.description) {
        const descBaseline =
          nameBaseline - nameLineCount * nameLineHeight * TYPOGRAPHY_SCALE - 4;
        wrapText(
          item.description,
          layout.serviceX,
          descBaseline,
          layout.serviceW,
          descSize,
          COLORS.muted,
          'normal',
          descLineHeight,
          2,
        );
      }

      text(String(item.quantity), layout.qtyX, rowCenter - 2, 9, COLORS.ink, 'normal', 'center');
      text(
        money(currencyCode, item.unitPrice),
        layout.priceRightX,
        rowCenter - 2,
        9,
        COLORS.ink2,
        'normal',
        'right',
      );
      text(
        money(currencyCode, item.total),
        layout.amountRightX,
        rowCenter - 2,
        9,
        COLORS.ink,
        'bold',
        'right',
      );
    });
  };

  const drawServiceTableHeaders = (
    headerRowY: number,
    contentW: number,
    margin: number,
  ) => {
    const layout = serviceTableLayout(margin, contentW);
    rr(margin + 14, headerRowY, contentW - 28, TABLE_HEADER_H, 10, COLORS.tableHead, null);
    const headerTextY = headerRowY + TABLE_HEADER_H / 2 - 3;
    const headerSize = 9;
    text('SERVICIO', layout.serviceX, headerTextY, headerSize, COLORS.ink2, 'bold');
    text('CANT.', layout.qtyX, headerTextY, headerSize, COLORS.ink2, 'bold', 'center');
    text('PRECIO', layout.priceRightX, headerTextY, headerSize, COLORS.ink2, 'bold', 'right');
    text('IMPORTE', layout.amountRightX, headerTextY, headerSize, COLORS.ink2, 'bold', 'right');
  };

  const drawPaymentSummary = (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    shadowCard(x, y, width, height, 16, COLORS.white);
    text('Resumen de pago', x + 16, y + height - 22, 10.5, COLORS.ink, 'bold');

    type SummaryRow = {
      label: string;
      amount: string;
      labelColor: string;
      amountColor: string;
      bold: boolean;
      note?: string;
    };

    const rows: SummaryRow[] = [];

    if (payload.hasAdjustment) {
      const adjustmentSign = payload.adjustmentAmount >= 0 ? '+' : '\u2212';
      const adjustmentColor =
        payload.adjustmentAmount >= 0 ? COLORS.amber : COLORS.green;
      rows.push({
        label: 'Subtotal',
        amount: money(currencyCode, payload.subtotal),
        labelColor: COLORS.muted,
        amountColor: COLORS.ink2,
        bold: false,
      });
      rows.push({
        label: 'Ajuste',
        amount: `${adjustmentSign}${money(currencyCode, Math.abs(payload.adjustmentAmount))}`,
        labelColor: adjustmentColor,
        amountColor: adjustmentColor,
        bold: true,
        note: 'Ajuste aplicado',
      });
    }

    rows.push({
      label: 'Total',
      amount: money(currencyCode, payload.total),
      labelColor: COLORS.ink,
      amountColor: COLORS.ink,
      bold: true,
    });
    rows.push({
      label: 'Pagado',
      amount: money(currencyCode, payload.paid),
      labelColor: COLORS.muted,
      amountColor: COLORS.ink2,
      bold: false,
    });

    const showBalanceDue = payload.balanceDue > 0;
    if (showBalanceDue) {
      rows.push({
        label: 'Por pagar',
        amount: money(currencyCode, payload.balanceDue),
        labelColor: COLORS.ink,
        amountColor: COLORS.ink,
        bold: true,
      });
    }

    let cursorY = y + height - 46;
    rows.forEach((row, index) => {
      const isPorPagar = row.label === 'Por pagar';
      if (isPorPagar) {
        setStroke('#EEF2F7');
        doc.setLineWidth(0.8);
        doc.line(x + 16, textY(cursorY + 10), x + width - 16, textY(cursorY + 10));
        cursorY -= 6;
      }

      const font: 'normal' | 'bold' = row.bold ? 'bold' : 'normal';
      text(row.label, x + 16, cursorY, 8.5, row.labelColor, font);
      text(row.amount, x + width - 16, cursorY, 8.5, row.amountColor, font, 'right');
      cursorY -= 18;
      if (row.note) {
        text(row.note, x + 16, cursorY + 4, 6.5, COLORS.muted2);
        cursorY -= 12;
      }

      // Keep a soft divider after Total when Pagado follows and Por pagar is absent.
      if (row.label === 'Total' && !showBalanceDue && index < rows.length - 1) {
        setStroke('#EEF2F7');
        doc.setLineWidth(0.8);
        doc.line(x + 16, textY(cursorY + 8), x + width - 16, textY(cursorY + 8));
        cursorY -= 4;
      }
    });
  };

  const drawMainPage = () => {
    drawBackground();

    const margin = 42;
    const contentW = W - 2 * margin;
    const headerH = HEADER_H;
    const headerY = H - margin - headerH;
    shadowCard(margin, headerY, contentW, headerH, 20, COLORS.navy, '#1E293B');
    gradientRect(margin, headerY, contentW, headerH, 20, COLORS.navy, '#312E81');

    doc.saveGraphicsState();
    doc.roundedRect(margin, yTop(headerY, headerH), contentW, headerH, 20, 20, null);
    doc.clip();
    for (let index = 0; index < 8; index += 1) {
      doc.setDrawColor('#4A4A7A');
      doc.setLineWidth(1);
      doc.circle(margin + contentW - 90, textY(headerY + 48), 12 + index * 12, 'S');
    }
    doc.discardPath();
    doc.restoreGraphicsState();

    const logoSize = ISSUER_LOGO_PLATE;
    const logoX = margin + 14;
    const logoTopPad = 12;
    const logoY = headerY + headerH - logoTopPad - logoSize;

    const badgeW = 80;
    const badgeH = 22;
    const badgeX = margin + contentW - badgeW - 14;
    const badgeY = logoY + (logoSize - badgeH) / 2;
    const badgeFill = isPaid ? COLORS.green : COLORS.amber;
    const badgeTextColor = isPaid ? COLORS.white : COLORS.ink;
    rr(badgeX, badgeY, badgeW, badgeH, 7, badgeFill, null);
    text(
      payload.statusLabel,
      badgeX + badgeW / 2,
      badgeY + 8,
      8,
      badgeTextColor,
      'bold',
      'center',
    );

    const issuerTextX = logoX + logoSize + 12;
    const issuerTextW = badgeX - issuerTextX - 12;
    const issuerNameSize = 15;
    const issuerNameLineH = 16;
    const issuerNameY = logoY + (logoSize - issuerNameSize) / 2 + 2;

    drawIssuerLogo(logoX, logoY, logoSize);
    wrapText(
      payload.issuer.name,
      issuerTextX,
      issuerNameY + 4,
      issuerTextW,
      issuerNameSize,
      COLORS.white,
      'bold',
      issuerNameLineH,
      1,
    );

    const metaY = headerY + 14;
    text(
      `Recibo No. ${payload.ticketNumber}`,
      margin + 16,
      metaY,
      8,
      '#CBD5E1',
      'bold',
    );
    text(
      `Fecha: ${payload.issueDate}`,
      margin + contentW - 16,
      metaY,
      8,
      '#94A3B8',
      'normal',
      'right',
    );

    const bodyTop = headerY - 10;

    const clientLines: Array<{ label?: string; value: string; size: number; font: 'normal' | 'bold'; color: string }> = [
      { value: payload.client.name, size: 13, font: 'bold', color: COLORS.ink },
    ];
    if (payload.client.phone) {
      clientLines.push({
        label: 'Teléfono',
        value: payload.client.phone,
        size: 9.5,
        font: 'normal',
        color: COLORS.ink2,
      });
    }
    if (payload.client.country) {
      clientLines.push({
        label: 'País',
        value: payload.client.country,
        size: 9.5,
        font: 'normal',
        color: COLORS.ink2,
      });
    }
    if (payload.client.address) {
      clientLines.push({
        label: 'Dirección',
        value: payload.client.address,
        size: 9,
        font: 'normal',
        color: COLORS.ink2,
      });
    }

    const clientPadTop = 18;
    const clientPadBottom = 14;
    const clientLabelH = 12;
    const clientLineGap = 8;
    const clientExtraLineH = 16;
    const clientNameH = 18;
    const clientContentH =
      clientLabelH +
      clientNameH +
      Math.max(0, clientLines.length - 1) * (clientExtraLineH + clientLineGap);
    const clientCardH = clientPadTop + clientPadBottom + clientContentH;
    const clientCardY = bodyTop - 8 - clientCardH;
    shadowCard(margin, clientCardY, contentW, clientCardH, 16, COLORS.surfaceBlue);
    label('Cliente', margin + 16, clientCardY + clientCardH - 16);

    let lineY = clientCardY + clientCardH - clientPadTop - clientLabelH - 4;
    clientLines.forEach((line, index) => {
      if (index === 0) {
        text(line.value, margin + 16, lineY, line.size, line.color, line.font);
        lineY -= clientNameH + 2;
        return;
      }
      if (line.label) {
        text(line.label, margin + 16, lineY, 7, COLORS.muted, 'bold');
        text(line.value, margin + 78, lineY, line.size, line.color, line.font, 'left', contentW - 100);
      } else {
        text(line.value, margin + 16, lineY, line.size, line.color, line.font);
      }
      lineY -= clientExtraLineH + clientLineGap;
    });

    const rowsOnPage = Math.min(payload.items.length, MAIN_PAGE_MAX_ROWS);
    const hasMoreItems = payload.items.length > MAIN_PAGE_MAX_ROWS;
    const continuationReserve = hasMoreItems ? 22 : 10;
    const itemsH = 52 + TABLE_HEADER_H + 8 + rowsOnPage * ROW_STEP + continuationReserve;
    const itemsY = clientCardY - 12 - itemsH;

    shadowCard(margin, itemsY, contentW, itemsH, 16);
    const sectionTitleY = itemsY + itemsH - 22;
    text('Detalle de servicios', margin + 16, sectionTitleY, 11, COLORS.ink, 'bold');
    text(
      payload.serviceCountLabel,
      margin + contentW - 16,
      sectionTitleY,
      8,
      COLORS.muted2,
      'normal',
      'right',
    );
    const headerRowY = itemsY + itemsH - 52 - TABLE_HEADER_H;
    drawServiceTableHeaders(headerRowY, contentW, margin);
    drawServiceRows(
      payload.items,
      headerRowY - 8,
      contentW,
      margin,
      MAIN_PAGE_MAX_ROWS,
    );
    if (hasMoreItems) {
      text(
        `+ ${payload.items.length - MAIN_PAGE_MAX_ROWS} conceptos en la página siguiente`,
        margin + 22,
        itemsY + 14,
        7.5,
        COLORS.muted,
      );
    }

    const showBalanceDue = payload.balanceDue > 0;
    let summaryH = 88;
    if (payload.hasAdjustment) summaryH += 36;
    if (showBalanceDue) summaryH += 28;
    const summaryY = itemsY - 12 - summaryH;
    drawPaymentSummary(margin, summaryY, contentW, summaryH);

    drawFooter();
  };

  const drawContinuationPage = (
    items: FintechInvoiceItem[],
    startIndex: number,
    totalItems: number,
  ) => {
    doc.addPage('a4', 'portrait');
    drawBackground();

    const margin = 42;
    const contentW = W - 2 * margin;
    const contextH = 28;
    const cardH = 52 + contextH + TABLE_HEADER_H + 8 + items.length * ROW_STEP + 18;
    const cardY = 128;
    shadowCard(margin, cardY, contentW, cardH, 16);

    const startNum = startIndex + 1;
    const endNum = startIndex + items.length;
    const sectionTitleY = cardY + cardH - 22;
    text(
      'Detalle de servicios (continuación)',
      margin + 16,
      sectionTitleY,
      11,
      COLORS.ink,
      'bold',
    );
    text(
      `Conceptos ${startNum}–${endNum} de ${totalItems}`,
      margin + contentW - 16,
      sectionTitleY,
      8,
      COLORS.muted2,
      'normal',
      'right',
    );
    text(
      `${payload.client.name} · Ticket #${payload.ticketNumber} · ${payload.issueDate}`,
      margin + 16,
      cardY + cardH - 42,
      7.5,
      COLORS.muted,
    );

    const headerRowY = cardY + cardH - 66 - TABLE_HEADER_H;
    drawServiceTableHeaders(headerRowY, contentW, margin);
    drawServiceRows(items, headerRowY - 8, contentW, margin, items.length);
    drawFooter();
  };

  drawMainPage();
  const remainingItems = payload.items.slice(MAIN_PAGE_MAX_ROWS);
  for (let index = 0; index < remainingItems.length; index += CONTINUATION_PAGE_MAX_ROWS) {
    drawContinuationPage(
      remainingItems.slice(index, index + CONTINUATION_PAGE_MAX_ROWS),
      MAIN_PAGE_MAX_ROWS + index,
      payload.items.length,
    );
  }

  return doc.output('arraybuffer');
}
