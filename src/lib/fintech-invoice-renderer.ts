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
const MAIN_PAGE_MAX_ROWS = 4;
const CONTINUATION_PAGE_MAX_ROWS = 12;
const ROW_STEP = 42;
const TYPOGRAPHY_SCALE = 0.82;
const ICON_SCALE = 0.82;

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
  white: '#FFFFFF',
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

  const progressBar = (x: number, y: number, width: number, height: number, pct: number) => {
    rr(x, y, width, height, height / 2, '#E8EEFF', null);
    if (pct > 0) {
      gradientRect(x, y, Math.max(height, width * pct), height, height / 2);
    }
  };

  const drawLogoPlaceholder = (x: number, y: number, size = 34) => {
    gradientRect(x, y, size, size, 10);
    doc.setDrawColor(COLORS.white);
    doc.setLineWidth(2.6);
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

  const drawIssuerLogo = (x: number, y: number, size = 34) => {
    if (issuerLogoDataUrl) {
      const format = detectPdfImageFormat(issuerLogoDataUrl);
      if (format) {
        try {
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
          return;
        } catch {
          // Fall back to vector placeholder when image data is invalid.
        }
      }
    }

    drawLogoPlaceholder(x, y, size);
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
    setStroke('#EEF2FF');
    doc.setLineWidth(0.55);
    for (let i = -6; i < 22; i += 1) {
      const x = i * 34;
      doc.line(x, textY(H - 35), x + 115, textY(H - 210));
    }
    for (let i = 0; i < 10; i += 1) {
      const y = H - 35 - i * 22;
      doc.line(34, textY(y), 560, textY(y - 82));
    }
    setFill('#F2F0FF');
    doc.circle(W - 78, textY(H - 110), 58, 'F');
    setFill('#EAF1FF');
    doc.circle(W - 155, textY(H - 56), 42, 'F');
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

      doc.circle(centerX, textY(y + iconScale), 7 * iconScale, 'S');
      doc.circle(centerX, textY(y + iconScale), 2 * iconScale, 'S');
      doc.line(
        centerX - 5 * iconScale,
        textY(y - 4 * iconScale),
        centerX,
        textY(y - 10 * iconScale),
      );
      doc.line(
        centerX + 5 * iconScale,
        textY(y - 4 * iconScale),
        centerX,
        textY(y - 10 * iconScale),
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

    items.slice(0, maxRows).forEach((item, index) => {
      const rowTop = firstRowY - index * ROW_STEP;
      const rowBottom = rowTop - ROW_STEP + 8;
      const rowCenter = rowTop - ROW_STEP / 2 + 2;

      setStroke('#EEF2F7');
      doc.setLineWidth(0.8);
      doc.line(margin + 18, textY(rowBottom), margin + contentW - 18, textY(rowBottom));

      const nameLineCount = countWrappedLines(
        item.name,
        layout.serviceW,
        nameSize,
        'bold',
        2,
      );
      const nameBaseline = rowTop - 8;
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
          nameBaseline - nameLineCount * nameLineHeight * TYPOGRAPHY_SCALE - 3;
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

      text(String(item.quantity), layout.qtyX, rowCenter - 3, 9, COLORS.ink, 'normal', 'center');
      text(
        money(currencyCode, item.unitPrice),
        layout.priceRightX,
        rowCenter - 3,
        9,
        COLORS.ink2,
        'normal',
        'right',
      );
      text(
        money(currencyCode, item.total),
        layout.amountRightX,
        rowCenter - 3,
        9,
        COLORS.ink,
        'bold',
        'right',
      );
    });
  };

  const drawPaymentSummary = (
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    fill = COLORS.white,
  ) => {
    shadowCard(x, y, width, height, 16, fill);
    text(title, x + 16, y + height - 24, 10.5, COLORS.ink, 'bold');

    if (payload.hasAdjustment) {
      text('Subtotal', x + 16, y + height - 44, 8.5, COLORS.muted);
      text(
        money(currencyCode, payload.subtotal),
        x + width - 16,
        y + height - 44,
        8.5,
        COLORS.ink2,
        'normal',
        'right',
      );
      text('Ajuste', x + 16, y + height - 60, 8.5, COLORS.muted);
      text(
        money(currencyCode, payload.adjustmentAmount),
        x + width - 16,
        y + height - 60,
        8.5,
        COLORS.ink2,
        'normal',
        'right',
      );
      text('Total', x + 16, y + height - 78, 8.5, COLORS.ink, 'bold');
      text(
        money(currencyCode, payload.total),
        x + width - 16,
        y + height - 78,
        8.5,
        COLORS.ink,
        'bold',
        'right',
      );
      setStroke('#EEF2F7');
      doc.line(x + 16, textY(y + 14), x + width - 16, textY(y + 14));
      text('Pagado', x + 16, y + 8, 8.5, COLORS.muted);
      text(
        money(currencyCode, payload.paid),
        x + width - 16,
        y + 8,
        8.5,
        COLORS.ink2,
        'normal',
        'right',
      );
      return;
    }

    text('Total', x + 16, y + height - 44, 8.5, COLORS.ink, 'bold');
    text(
      money(currencyCode, payload.total),
      x + width - 16,
      y + height - 44,
      8.5,
      COLORS.ink,
      'bold',
      'right',
    );
    setStroke('#EEF2F7');
    doc.line(x + 16, textY(y + 28), x + width - 16, textY(y + 28));
    text('Pagado', x + 16, y + 8, 8.5, COLORS.muted);
    text(
      money(currencyCode, payload.paid),
      x + width - 16,
      y + 8,
      8.5,
      COLORS.ink2,
      'normal',
      'right',
    );
  };

  const drawMainPage = () => {
    drawBackground();

    const margin = 42;
    const contentW = W - 2 * margin;
    const headerH = 138;
    const headerY = H - margin - headerH;
    shadowCard(margin, headerY, contentW, headerH, 20, COLORS.navy, '#1E293B');
    gradientRect(margin, headerY, contentW, headerH, 20, COLORS.navy, '#312E81');

    doc.saveGraphicsState();
    doc.roundedRect(margin, yTop(headerY, headerH), contentW, headerH, 20, 20, null);
    doc.clip();
    for (let index = 0; index < 8; index += 1) {
      doc.setDrawColor('#4A4A7A');
      doc.setLineWidth(1);
      doc.circle(margin + contentW - 110, textY(headerY + 72), 16 + index * 14, 'S');
    }
    doc.discardPath();
    doc.restoreGraphicsState();

    const balanceW = 180;
    const balanceH = 66;
    const balanceX = margin + contentW - balanceW - 20;
    const balanceY = headerY + 30;
    const logoSize = 23;
    const logoX = margin + 20;
    const logoY = headerY + headerH - 42;
    const issuerTextX = logoX + logoSize + 10;
    const issuerTextW = balanceX - issuerTextX - 14;

    drawIssuerLogo(logoX, logoY, logoSize);
    wrapText(
      payload.issuer.name,
      issuerTextX,
      logoY + logoSize - 6,
      issuerTextW,
      13,
      COLORS.white,
      'bold',
      15,
      2,
    );
    text(payload.issuer.address, issuerTextX, logoY + 2, 7.5, '#CBD5E1', 'normal', 'left', issuerTextW);
    text(
      `Tel. ${payload.issuer.phone || 'Sin teléfono'}`,
      issuerTextX,
      logoY - 10,
      7.5,
      '#CBD5E1',
      'normal',
      'left',
      issuerTextW,
    );

    text(`Ticket No. ${payload.ticketNumber}`, margin + 22, headerY + 30, 8.5, '#CBD5E1', 'bold');
    text(`Fecha: ${payload.issueDate}`, margin + 22, headerY + 16, 8.5, '#CBD5E1');

    gradientRect(margin + contentW - 92, headerY + headerH - 38, 62, 15, 7.5);
    text(payload.statusLabel, margin + contentW - 61, headerY + headerH - 31.5, 6.5, COLORS.white, 'bold', 'center');

    rr(balanceX, balanceY, balanceW, balanceH, 14, COLORS.white, COLORS.white);
    label(payload.balanceLabel, balanceX + 12, balanceY + 52);
    text(
      money(
        currencyCode,
        payload.balanceDue > 0 ? payload.balanceDue : payload.total,
      ),
      balanceX + 12,
      balanceY + 32,
      17,
      COLORS.ink,
      'bold',
      'left',
      balanceW - 24,
    );
    wrapText(
      `${money(currencyCode, payload.paid)} / ${money(currencyCode, payload.total)}`,
      balanceX + 12,
      balanceY + 17,
      balanceW - 24,
      7.5,
      COLORS.muted,
      'normal',
      9,
      2,
    );
    progressBar(balanceX + 12, balanceY + 7, balanceW - 24, 3, payload.paymentProgress);

    const bodyTop = headerY - 16;
    const clientCardH = 72;
    const clientCardY = bodyTop - clientCardH;

    shadowCard(margin, clientCardY, contentW, clientCardH, 16);
    label('Cliente', margin + 16, bodyTop - 18);
    wrapText(
      payload.client.name,
      margin + 16,
      bodyTop - 38,
      contentW - 32,
      13,
      COLORS.ink,
      'bold',
      15,
      2,
    );
    const clientMeta = payload.client.country
      ? `${payload.client.phone} · ${payload.client.country}`
      : payload.client.phone;
    text(clientMeta, margin + 16, bodyTop - 58, 8.5, COLORS.muted);

    const rowsOnPage = Math.min(payload.items.length, MAIN_PAGE_MAX_ROWS);
    const hasMoreItems = payload.items.length > MAIN_PAGE_MAX_ROWS;
    const continuationReserve = hasMoreItems ? 22 : 10;
    const itemsH = 52 + 30 + rowsOnPage * ROW_STEP + continuationReserve;
    const itemsY = clientCardY - 14 - itemsH;

    shadowCard(margin, itemsY, contentW, itemsH, 16);
    text('Detalle de servicios', margin + 16, itemsY + itemsH - 26, 11, COLORS.ink, 'bold');
    text(payload.serviceCountLabel, margin + contentW - 16, itemsY + itemsH - 24, 7.5, COLORS.muted, 'normal', 'right');
    const headerRowY = itemsY + itemsH - 58;
    rr(margin + 14, headerRowY, contentW - 28, 30, 10, COLORS.tableHead, null);
    label('Servicio', margin + 22, headerRowY + 11);
    label('Cant.', margin + contentW - 248, headerRowY + 11);
    label('Precio', margin + contentW - 160, headerRowY + 11);
    label('Importe', margin + contentW - 74, headerRowY + 11);
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

    const summaryH = payload.hasAdjustment ? 106 : 92;
    const summaryY = itemsY - 12 - summaryH;
    const summaryW = 236;
    drawPaymentSummary(
      margin + contentW - summaryW,
      summaryY,
      summaryW,
      summaryH,
      'Resumen de pago',
    );

    const progressW = contentW - summaryW - 14;
    const progressH = summaryH;
    shadowCard(margin, summaryY, progressW, progressH, 16, '#FBFDFF');
    text('Progreso de pago', margin + 16, summaryY + progressH - 24, 10.5, COLORS.ink, 'bold');
    text(
      payload.paymentProgressLabel,
      margin + progressW - 16,
      summaryY + progressH - 24,
      8,
      COLORS.blue,
      'bold',
      'right',
    );
    progressBar(margin + 16, summaryY + progressH - 44, progressW - 32, 6, payload.paymentProgress);
    if (!isPaid) {
      text(`${money(currencyCode, payload.paid)} pagado`, margin + 16, summaryY + 24, 7.8, COLORS.muted);
      text(
        `${money(currencyCode, payload.balanceDue)} pendiente`,
        margin + progressW - 16,
        summaryY + 24,
        7.8,
        COLORS.muted,
        'normal',
        'right',
      );
    }

    if (!isPaid) {
      const bannerH = 46;
      const bannerY = summaryY - 12 - bannerH;
      gradientRect(margin, bannerY, contentW, bannerH, 16);
      text(payload.balanceLabel, margin + 20, bannerY + 28, 8, '#E0E7FF', 'bold');
      text(
        money(currencyCode, payload.balanceDue),
        margin + 20,
        bannerY + 10,
        14,
        COLORS.white,
        'bold',
      );
      text(payload.dueText, margin + contentW - 20, bannerY + 16, 7.5, '#E0E7FF', 'normal', 'right');
    }

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
    const cardH = 52 + contextH + 30 + items.length * ROW_STEP + 18;
    const cardY = 128;
    shadowCard(margin, cardY, contentW, cardH, 16);

    const startNum = startIndex + 1;
    const endNum = startIndex + items.length;
    text(
      'Detalle de servicios (continuación)',
      margin + 16,
      cardY + cardH - 26,
      11,
      COLORS.ink,
      'bold',
    );
    text(
      `Conceptos ${startNum}–${endNum} de ${totalItems}`,
      margin + contentW - 16,
      cardY + cardH - 24,
      7.5,
      COLORS.muted,
      'normal',
      'right',
    );
    text(
      `${payload.client.name} · Ticket #${payload.ticketNumber} · ${payload.issueDate}`,
      margin + 16,
      cardY + cardH - 44,
      7.5,
      COLORS.muted,
    );

    const headerRowY = cardY + cardH - 72;
    rr(margin + 14, headerRowY, contentW - 28, 30, 10, COLORS.tableHead, null);
    label('Servicio', margin + 22, headerRowY + 11);
    label('Cant.', margin + contentW - 248, headerRowY + 11);
    label('Precio', margin + contentW - 160, headerRowY + 11);
    label('Importe', margin + contentW - 74, headerRowY + 11);
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
