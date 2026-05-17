import { jsPDF } from 'jspdf';
import type {
  FintechInvoiceItem,
  FintechInvoicePayload,
} from '@/lib/fintech-invoice-payload';

const W = 595.2756;
const H = 841.8898;

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

const conceptLabel = (count: number): string =>
  count === 1 ? '1 concepto facturado' : `${count} conceptos facturados`;

export function renderFintechInvoicePdf(
  payload: FintechInvoicePayload,
): ArrayBuffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  }) as JsPdfWithGraphics;

  const currencyCode = payload.issuer.currencyCode;

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
    doc.setFontSize(size);
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
    text(value.toUpperCase(), x, y, 7.1, color, 'bold');
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

  const drawLogo = (x: number, y: number, size = 34) => {
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
  ) => {
    doc.setTextColor(color);
    doc.setFont('helvetica', font);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(value, width).slice(0, maxLines) as string[];
    lines.forEach((line, index) => {
      const suffix =
        index === maxLines - 1 &&
        doc.splitTextToSize(value, width).length > maxLines
          ? truncateText(line, width)
          : line;
      doc.text(suffix, x, textY(y - index * lineHeight));
    });
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
    const footerY = 58;
    setStroke(COLORS.line);
    doc.setLineWidth(0.8);
    doc.line(margin, textY(footerY + 54), margin + contentW, textY(footerY + 54));

    const drawFooterIcon = (
      kind: 'phone' | 'email' | 'address',
      x: number,
      y: number,
    ) => {
      setStroke(COLORS.blue);
      doc.setLineWidth(1.4);
      if (kind === 'phone') {
        doc.roundedRect(x - 5, textY(y + 8), 10, 16, 2, 2, 'S');
        doc.line(x - 2, textY(y - 5), x + 2, textY(y - 5));
        return;
      }

      if (kind === 'email') {
        doc.roundedRect(x - 8, textY(y + 6), 16, 11, 2, 2, 'S');
        doc.line(x - 8, textY(y + 6), x, textY(y - 1));
        doc.line(x + 8, textY(y + 6), x, textY(y - 1));
        return;
      }

      doc.circle(x, textY(y + 1), 7, 'S');
      doc.circle(x, textY(y + 1), 2, 'S');
      doc.line(x - 5, textY(y - 4), x, textY(y - 10));
      doc.line(x + 5, textY(y - 4), x, textY(y - 10));
    };

    const contacts: Array<['phone' | 'email' | 'address', string, string]> = [
      ['phone', 'TELÉFONO', payload.issuer.phone || 'Sin teléfono'],
      ['email', 'CORREO', payload.issuer.email || 'Sin correo'],
      ['address', 'DIRECCIÓN', payload.issuer.footerAddress || payload.issuer.address],
    ];
    const colXs = [
      margin + contentW * 0.17,
      margin + contentW * 0.5,
      margin + contentW * 0.83,
    ];
    contacts.forEach(([kind, title, value], index) => {
      const x = colXs[index];
      rr(x - 13, footerY + 20, 26, 26, 13, COLORS.surfaceBlue, '#DBEAFE');
      drawFooterIcon(kind, x, footerY + 28);
      text(title, x, footerY + 4, 7.2, COLORS.ink2, 'bold', 'center');
      text(value, x, footerY - 12, 7.2, COLORS.muted, 'normal', 'center', 144);
    });

    text('Powered by', W / 2 - 15, 24, 6.5, COLORS.muted2, 'normal', 'right');
    text('zigzag', W / 2 - 11, 24, 6.5, COLORS.ink2, 'bold');
    setStroke(COLORS.ink2);
    doc.setLineWidth(0.4);
    doc.line(W / 2 - 11, textY(23), W / 2 + 10, textY(23));
  };

  const drawServiceRows = (
    items: FintechInvoiceItem[],
    rowY: number,
    contentW: number,
    margin: number,
    maxRows: number,
  ) => {
    items.slice(0, maxRows).forEach((item, index) => {
      const y = rowY - index * 38;
      setStroke('#EEF2F7');
      doc.setLineWidth(0.8);
      doc.line(margin + 18, textY(y + 44), margin + contentW - 18, textY(y + 44));
      rr(margin + 23, y + 11, 26, 26, 8, COLORS.surfaceBlue, null);
      text(String(item.number), margin + 36, y + 19, 10, COLORS.blue, 'bold', 'center');
      wrapText(item.name, margin + 80, y + 30, 180, 12.5, COLORS.ink, 'bold', 13, 1);
      if (item.description) {
        wrapText(item.description, margin + 80, y + 12, 180, 8.8, COLORS.muted, 'normal', 10, 1);
      }
      text(String(item.quantity), margin + contentW - 230, y + 21, 10.5, COLORS.ink, 'normal', 'center');
      text(money(currencyCode, item.unitPrice), margin + contentW - 116, y + 21, 10.5, COLORS.ink2, 'normal', 'right');
      text(money(currencyCode, item.total), margin + contentW - 22, y + 21, 10.7, COLORS.ink, 'bold', 'right');
    });
  };

  const drawMainPage = () => {
    drawBackground();

    const margin = 42;
    const contentW = W - 2 * margin;
    const headerH = 178;
    const headerY = H - margin - headerH;
    shadowCard(margin, headerY, contentW, headerH, 24, COLORS.navy, '#1E293B');
    gradientRect(margin, headerY, contentW, headerH, 24, COLORS.navy, '#312E81');

    doc.saveGraphicsState();
    doc.roundedRect(margin, yTop(headerY, headerH), contentW, headerH, 24, 24, null);
    doc.clip();
    for (let index = 0; index < 8; index += 1) {
      doc.setDrawColor('#4A4A7A');
      doc.setLineWidth(1);
      doc.circle(margin + contentW - 120, textY(headerY + 90), 20 + index * 16, 'S');
    }
    doc.discardPath();
    doc.restoreGraphicsState();

    const logoX = margin + 26;
    const logoY = headerY + headerH - 55;
    drawLogo(logoX, logoY, 34);
    text(payload.issuer.name, logoX + 46, logoY + 21, 16, COLORS.white, 'bold', 'left', 165);
    text(payload.issuer.address, logoX + 46, logoY + 6, 8.1, '#CBD5E1', 'normal', 'left', 210);
    text(`Tel. ${payload.issuer.phone || 'Sin teléfono'}`, logoX + 46, logoY - 8, 8.1, '#CBD5E1', 'normal', 'left', 210);

    text(`Ticket No. ${payload.ticketNumber}`, margin + 28, headerY + 38, 9.5, '#CBD5E1', 'bold');
    text(`Fecha: ${payload.issueDate}`, margin + 28, headerY + 22, 9.5, '#CBD5E1');

    gradientRect(margin + contentW - 124, headerY + headerH - 54, 92, 24, 12);
    text(payload.statusLabel, margin + contentW - 78, headerY + headerH - 44, 8, COLORS.white, 'bold', 'center');

    const balanceW = 214;
    const balanceH = 96;
    const balanceX = margin + contentW - balanceW - 30;
    const balanceY = headerY + 34;
    rr(balanceX, balanceY, balanceW, balanceH, 20, COLORS.white, COLORS.white);
    label(payload.balanceLabel, balanceX + 18, balanceY + 70);
    text(
      money(
        currencyCode,
        payload.balanceDue > 0 ? payload.balanceDue : payload.total,
      ),
      balanceX + 18,
      balanceY + 42,
      25,
      COLORS.ink,
      'bold',
    );
    text(
      `Pagado ${money(currencyCode, payload.paid)} de ${money(currencyCode, payload.total)}`,
      balanceX + 18,
      balanceY + 22,
      8.2,
      COLORS.muted,
      'normal',
      'left',
      balanceW - 36,
    );
    progressBar(balanceX + 18, balanceY + 12, balanceW - 36, 5.5, payload.paymentProgress);

    const bodyTop = headerY - 24;
    const clientW = (contentW - 16) * 0.5;
    const infoW = (contentW - 16) * 0.5;
    shadowCard(margin, bodyTop - 92, clientW, 92, 18);
    label('Cliente', margin + 20, bodyTop - 28);
    text(payload.client.name, margin + 20, bodyTop - 52, 20, COLORS.ink, 'bold', 'left', clientW - 135);
    text(payload.client.phone, margin + 20, bodyTop - 70, 9.2, COLORS.muted, 'normal', 'left', 82);
    text(payload.client.country, margin + 112, bodyTop - 70, 9.2, COLORS.muted);
    rr(margin + clientW - 105, bodyTop - 36, 84, 19, 9, COLORS.greenSoft, null);
    text(payload.client.statusLabel, margin + clientW - 63, bodyTop - 28.05, 7.1, COLORS.green, 'bold', 'center');

    shadowCard(margin + clientW + 16, bodyTop - 92, infoW, 92, 18);
    label('Emisor', margin + clientW + 36, bodyTop - 28);
    text(payload.issuer.name, margin + clientW + 36, bodyTop - 52, 17, COLORS.ink, 'bold', 'left', 130);
    text(payload.issuer.email || 'Sin correo', margin + clientW + 36, bodyTop - 70, 9.2, COLORS.muted, 'normal', 'left', 138);
    rr(margin + contentW - 110, bodyTop - 62, 78, 24, 12, COLORS.surfaceBlue, null);
    text(`#${payload.ticketNumber}`, margin + contentW - 71, bodyTop - 51, 9.4, COLORS.ink, 'bold', 'center');

    const itemsY = bodyTop - 278;
    const itemsH = 160;
    shadowCard(margin, itemsY, contentW, itemsH, 18);
    text('Detalle de servicios', margin + 20, itemsY + itemsH - 30, 13.5, COLORS.ink, 'bold');
    text(payload.serviceCountLabel, margin + contentW - 20, itemsY + itemsH - 28, 8.5, COLORS.muted, 'normal', 'right');
    const headerRowY = itemsY + itemsH - 72;
    rr(margin + 14, headerRowY, contentW - 28, 36, 12, COLORS.tableHead, null);
    label('Núm.', margin + 28, headerRowY + 13);
    label('Servicio', margin + 80, headerRowY + 13);
    label('Cant.', margin + contentW - 248, headerRowY + 13);
    label('Precio', margin + contentW - 160, headerRowY + 13);
    label('Importe', margin + contentW - 74, headerRowY + 13);
    drawServiceRows(payload.items, itemsY + 38, contentW, margin, 2);
    if (payload.items.length > 2) {
      text(
        `+ ${payload.items.length - 2} conceptos en la página siguiente`,
        margin + 80,
        itemsY + 12,
        8.5,
        COLORS.muted,
      );
    }

    const summaryY = itemsY - 124;
    const summaryW = 252;
    shadowCard(margin + contentW - summaryW, summaryY, summaryW, 104, 18);
    text('Resumen de pago', margin + contentW - summaryW + 18, summaryY + 78, 12.5, COLORS.ink, 'bold');
    text('Subtotal', margin + contentW - summaryW + 18, summaryY + 54, 9.4, COLORS.muted);
    text(money(currencyCode, payload.subtotal), margin + contentW - 18, summaryY + 54, 9.4, COLORS.ink2, 'normal', 'right');
    text('Total', margin + contentW - summaryW + 18, summaryY + 32, 9.4, COLORS.ink, 'bold');
    text(money(currencyCode, payload.total), margin + contentW - 18, summaryY + 32, 9.4, COLORS.ink, 'bold', 'right');
    setStroke('#EEF2F7');
    doc.line(margin + contentW - summaryW + 18, textY(summaryY + 22), margin + contentW - 18, textY(summaryY + 22));
    text('Pagado', margin + contentW - summaryW + 18, summaryY + 10, 9.4, COLORS.muted);
    text(money(currencyCode, payload.paid), margin + contentW - 18, summaryY + 10, 9.4, COLORS.ink2, 'normal', 'right');

    const progressW = contentW - summaryW - 18;
    shadowCard(margin, summaryY, progressW, 104, 18, '#FBFDFF');
    text('Progreso de pago', margin + 20, summaryY + 78, 12.5, COLORS.ink, 'bold');
    text(payload.paymentProgressLabel, margin + progressW - 20, summaryY + 78, 9, COLORS.blue, 'bold', 'right');
    progressBar(margin + 20, summaryY + 52, progressW - 40, 10, payload.paymentProgress);
    text(`${money(currencyCode, payload.paid)} pagado`, margin + 20, summaryY + 28, 8.8, COLORS.muted);
    text(
      payload.balanceDue > 0
        ? `${money(currencyCode, payload.balanceDue)} pendiente`
        : 'Sin saldo pendiente',
      margin + progressW - 20,
      summaryY + 28,
      8.8,
      COLORS.muted,
      'normal',
      'right',
    );

    const bannerY = summaryY - 78;
    gradientRect(margin, bannerY, contentW, 58, 20);
    text(payload.balanceLabel, margin + 24, bannerY + 34, 9.2, '#E0E7FF', 'bold');
    text(
      money(
        currencyCode,
        payload.balanceDue > 0 ? payload.balanceDue : payload.total,
      ),
      margin + 24,
      bannerY + 13,
      18.5,
      COLORS.white,
      'bold',
    );
    text(payload.dueText, margin + contentW - 24, bannerY + 20, 8.2, '#E0E7FF', 'normal', 'right');

    drawFooter();
  };

  const drawContinuationPage = (items: FintechInvoiceItem[]) => {
    doc.addPage('a4', 'portrait');
    drawBackground();
    const margin = 42;
    const contentW = W - 2 * margin;
    const cardY = 160;
    const cardH = 610;
    shadowCard(margin, cardY, contentW, cardH, 18);
    text('Detalle de servicios', margin + 20, cardY + cardH - 30, 13.5, COLORS.ink, 'bold');
    text(conceptLabel(items.length), margin + contentW - 20, cardY + cardH - 28, 8.5, COLORS.muted, 'normal', 'right');
    const headerRowY = cardY + cardH - 72;
    rr(margin + 14, headerRowY, contentW - 28, 36, 12, COLORS.tableHead, null);
    label('Núm.', margin + 28, headerRowY + 13);
    label('Servicio', margin + 80, headerRowY + 13);
    label('Cant.', margin + contentW - 248, headerRowY + 13);
    label('Precio', margin + contentW - 160, headerRowY + 13);
    label('Importe', margin + contentW - 74, headerRowY + 13);
    drawServiceRows(items, cardY + cardH - 118, contentW, margin, 12);
    drawFooter();
  };

  drawMainPage();
  const remainingItems = payload.items.slice(2);
  for (let index = 0; index < remainingItems.length; index += 12) {
    drawContinuationPage(remainingItems.slice(index, index + 12));
  }

  return doc.output('arraybuffer');
}
