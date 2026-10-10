/**
 * Presupuesto / recibo PDF, design 2a (docs/pdf-design-2a). Server-only.
 *
 * Layout runs in CSS px (the design's unit) and converts to pt when drawing.
 * Text positions follow Chrome's line boxes for IBM Plex (see baselineFrom in
 * layout.ts), so the PDF lands on the same px as receipt-template.html.
 */
import { jsPDF } from 'jspdf';
import { detectPdfImageFormat } from '@/lib/company-logo-branding-shared';
import { RECEIPT_FONTS, registerReceiptFonts, type ReceiptFont } from './fonts';
import {
  COLOPHON,
  COLORS,
  CONTENT_BOTTOM,
  CONTENT_LEFT,
  CONTENT_RIGHT,
  CONTENT_WIDTH,
  DOUBLE_RULE,
  baselineFrom,
  fontAscentPx,
  FOOTER,
  HEADER,
  LABEL,
  META,
  PAGE,
  PILL,
  PX_TO_PT,
  TABLE,
  TOTALS,
  normalLineHeight,
} from './layout';
import {
  formatReceiptMoney,
  formatReceiptQuantity,
  type ReceiptPdfItem,
  type ReceiptPdfPayload,
} from './payload';

export type ReceiptPdfRenderOptions = {
  /** Company logo as a data URL (PNG/JPEG/WEBP); null draws the initial circle. */
  logoDataUrl?: string | null;
  /** Deflate content streams. Tests turn it off to read the text layer. */
  compress?: boolean;
};

type Align = 'left' | 'right' | 'center';

type TextStyle = {
  font: ReceiptFont;
  size: number;
  color: string;
  /** Letter-spacing in em. */
  tracking?: number;
};

const pt = (px: number): number => px * PX_TO_PT;

const pluralConceptos = (count: number): string =>
  count === 1 ? 'concepto' : 'conceptos';

const S = {
  label: { font: RECEIPT_FONTS.sans400, size: LABEL.size, color: COLORS.label, tracking: LABEL.tracking },
  name: { font: RECEIPT_FONTS.sans600, size: HEADER.nameSize, color: COLORS.ink },
  tagline: { font: RECEIPT_FONTS.sans400, size: HEADER.taglineSize, color: COLORS.label },
  initial: { font: RECEIPT_FONTS.sans600, size: HEADER.initialSize, color: COLORS.ink },
  title: { font: RECEIPT_FONTS.sans500, size: HEADER.titleSize, color: COLORS.ink, tracking: HEADER.titleTracking },
  folio: { font: RECEIPT_FONTS.mono400, size: HEADER.folioSize, color: COLORS.ink },
  date: { font: RECEIPT_FONTS.mono400, size: HEADER.dateSize, color: COLORS.muted },
  primary: { font: RECEIPT_FONTS.sans600, size: META.primarySize, color: COLORS.ink },
  secondary: { font: RECEIPT_FONTS.sans400, size: META.secondarySize, color: COLORS.secondary },
  pill: { font: RECEIPT_FONTS.sans600, size: PILL.size, color: COLORS.ink, tracking: PILL.tracking },
  index: { font: RECEIPT_FONTS.mono400, size: TABLE.indexSize, color: COLORS.hint },
  itemName: { font: RECEIPT_FONTS.sans600, size: TABLE.nameSize, color: COLORS.ink },
  itemDescription: { font: RECEIPT_FONTS.sans400, size: TABLE.descriptionSize, color: COLORS.description },
  number: { font: RECEIPT_FONTS.mono400, size: TABLE.numberSize, color: COLORS.ink },
  amount: { font: RECEIPT_FONTS.mono500, size: TABLE.numberSize, color: COLORS.ink },
  totalsLabel: { font: RECEIPT_FONTS.sans400, size: TOTALS.size, color: COLORS.muted },
  totalsValue: { font: RECEIPT_FONTS.mono400, size: TOTALS.size, color: COLORS.ink },
  dueLabel: { font: RECEIPT_FONTS.sans600, size: TOTALS.dueLabelSize, color: COLORS.ink },
  dueValue: { font: RECEIPT_FONTS.mono500, size: TOTALS.dueValueSize, color: COLORS.ink },
  footerValue: { font: RECEIPT_FONTS.sans400, size: FOOTER.size, color: COLORS.secondary },
  colophon: { font: RECEIPT_FONTS.sans400, size: COLOPHON.size, color: COLORS.hint, tracking: COLOPHON.tracking },
} satisfies Record<string, TextStyle>;

/** Thin px-space drawing layer over jsPDF. */
class Pen {
  constructor(readonly doc: jsPDF) {}

  private use(style: TextStyle): void {
    this.doc.setFont(style.font, 'normal');
    this.doc.setFontSize(pt(style.size));
    this.doc.setTextColor(style.color);
  }

  /** Advance width in px, letter-spacing included after every character (as CSS does). */
  width(value: string, style: TextStyle): number {
    this.use(style);
    const tracking = (style.tracking ?? 0) * style.size;
    return this.doc.getTextWidth(value) / PX_TO_PT + tracking * [...value].length;
  }

  text(value: string, x: number, baseline: number, style: TextStyle, align: Align = 'left'): void {
    if (!value) return;
    const advance = this.width(value, style);
    const left = align === 'right' ? x - advance : align === 'center' ? x - advance / 2 : x;
    this.use(style);
    const tracking = (style.tracking ?? 0) * style.size;
    this.doc.text(value, pt(left), pt(baseline), tracking ? { charSpace: pt(tracking) } : {});
  }

  /** Wraps to `maxWidth`; the last kept line gets an ellipsis when text is cut. */
  wrap(value: string, style: TextStyle, maxWidth: number, maxLines: number): string[] {
    const clean = value.replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    this.use(style);
    const lines = this.doc.splitTextToSize(clean, pt(maxWidth)) as string[];
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = this.ellipsize(`${kept[maxLines - 1]}…`, style, maxWidth);
    return kept;
  }

  ellipsize(value: string, style: TextStyle, maxWidth: number): string {
    if (this.width(value, style) <= maxWidth) return value;
    let next = value.replace(/…$/, '');
    while (next.length > 1 && this.width(`${next.trimEnd()}…`, style) > maxWidth) {
      next = next.slice(0, -1);
    }
    return `${next.trimEnd()}…`;
  }

  fillRect(x: number, y: number, w: number, h: number, color: string): void {
    this.doc.setFillColor(color);
    this.doc.rect(pt(x), pt(y), pt(w), pt(h), 'F');
  }

  /** Horizontal 1px-style line centered on `y`, dashed when `dash` is given. */
  hline(x1: number, x2: number, y: number, color: string, weight: number, dash?: readonly number[]): void {
    this.doc.setDrawColor(color);
    this.doc.setLineWidth(pt(weight));
    this.doc.setLineCap('butt');
    this.doc.setLineDashPattern(dash ? dash.map(pt) : [], 0);
    this.doc.line(pt(x1), pt(y), pt(x2), pt(y));
    this.doc.setLineDashPattern([], 0);
  }
}

type BrandLayout = {
  logo: { dataUrl: string; format: string; width: number; height: number } | null;
  nameLines: string[];
  tagline: string | null;
  height: number;
};

type MetaColumn = {
  label: string;
  primary: string | null;
  pill: string | null;
  secondary: string[];
};

type RowLayout = {
  item: ReceiptPdfItem;
  nameLines: string[];
  descriptionLines: string[];
  height: number;
};

type TotalsLayout = {
  rows: Array<{ label: string; value: string }>;
  due: { label: string; value: string; stacked: boolean };
  height: number;
};

const NAME_LINE = normalLineHeight(TABLE.nameSize);
const DESCRIPTION_LINE = normalLineHeight(TABLE.descriptionSize);
const LABEL_LINE = normalLineHeight(LABEL.size);
const SECONDARY_LINE = META.secondarySize * META.secondaryLineHeight;
const PILL_HEIGHT = PILL.border * 2 + PILL.paddingY * 2 + normalLineHeight(PILL.size);
const TOTALS_LINE = normalLineHeight(TOTALS.size);
const FOOTER_LINE = FOOTER.size * FOOTER.lineHeight;
const FOOTER_LABEL_LINE = LABEL.size * FOOTER.lineHeight;
const COLOPHON_LINE = normalLineHeight(COLOPHON.size);
const COLOPHON_TOP = CONTENT_BOTTOM - COLOPHON_LINE;
/** Lowest y a table row may reach on a page without the footer. */
const ROWS_BOTTOM = COLOPHON_TOP - COLOPHON.marginTop;

const loadLogo = (doc: jsPDF, dataUrl: string | null | undefined): BrandLayout['logo'] => {
  if (!dataUrl) return null;
  const format = detectPdfImageFormat(dataUrl);
  if (!format) return null;
  try {
    const { width, height } = doc.getImageProperties(dataUrl);
    if (!(width > 0 && height > 0)) return null;
    const ratio = width / height;
    const drawWidth = Math.min(HEADER.logoHeight * ratio, HEADER.logoMaxWidth);
    return { dataUrl, format, width: drawWidth, height: drawWidth / ratio };
  } catch {
    return null;
  }
};

export function renderReceiptPdf(
  payload: ReceiptPdfPayload,
  options: ReceiptPdfRenderOptions = {},
): ArrayBuffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
    compress: options.compress ?? true,
  });
  registerReceiptFonts(doc);
  doc.setProperties({
    title: `${payload.docTitle} ${payload.folio}`,
    subject: payload.company.name,
    creator: 'zigzag',
  });
  const pen = new Pen(doc);
  const money = (value: number) => formatReceiptMoney(value, payload.currencyCode);

  // ---------- measure: header ----------
  const titleWidth = pen.width(payload.docTitle, S.title);
  const docBlockWidth = Math.max(
    titleWidth,
    pen.width(`Folio ${payload.folio}`, S.folio),
    pen.width(payload.issueDate, S.date),
  );
  const docBlockHeight =
    HEADER.titleSize * HEADER.titleLineHeight +
    HEADER.docGap +
    normalLineHeight(HEADER.folioSize) +
    HEADER.docGap +
    normalLineHeight(HEADER.dateSize);

  const logo = loadLogo(doc, options.logoDataUrl);
  const markWidth = logo ? logo.width : HEADER.logoHeight;
  const brandTextWidth = Math.max(
    CONTENT_WIDTH - docBlockWidth - 24 - markWidth - HEADER.brandGap,
    80,
  );
  const nameLines = pen.wrap(payload.company.name, S.name, brandTextWidth, 2);
  const tagline = payload.company.tagline
    ? pen.ellipsize(payload.company.tagline, S.tagline, brandTextWidth)
    : null;
  const brandTextHeight =
    nameLines.length * normalLineHeight(HEADER.nameSize) +
    (tagline ? HEADER.taglineGap + normalLineHeight(HEADER.taglineSize) : 0);
  const brand: BrandLayout = {
    logo,
    nameLines,
    tagline,
    height: Math.max(HEADER.logoHeight, brandTextHeight),
  };
  const headerHeight = Math.max(brand.height, docBlockHeight);

  // ---------- measure: meta ----------
  const columnWidth = CONTENT_WIDTH / 3;
  const metaColumns: Array<{ x: number; width: number; border: boolean }> = [
    { x: CONTENT_LEFT, width: columnWidth - META.columnPadding, border: false },
    {
      x: CONTENT_LEFT + columnWidth + META.border + META.columnPadding,
      width: columnWidth - META.border - META.columnPadding * 2,
      border: true,
    },
    {
      x: CONTENT_LEFT + columnWidth * 2 + META.border + META.columnPadding,
      width: columnWidth - META.border - META.columnPadding,
      border: true,
    },
  ];

  const countLabel = `${payload.itemCount} ${pluralConceptos(payload.itemCount)}`;
  const metaContent: MetaColumn[] = [
    {
      label: 'Cliente',
      primary: payload.client.name,
      pill: null,
      secondary: [payload.client.phone, payload.client.country].filter(
        (line): line is string => Boolean(line),
      ),
    },
    {
      label: 'Fecha de emisión',
      primary: payload.issueDate,
      pill: null,
      secondary:
        payload.docType === 'presupuesto'
          ? payload.validity
            ? [
                `Vigencia ${payload.validity.days} ${payload.validity.days === 1 ? 'día' : 'días'}`,
                `Vence ${payload.validity.expiryDate}`,
              ]
            : ['Sin vencimiento']
          : payload.recibo?.paidOnDate
            ? [`Pagado el ${payload.recibo.paidOnDate}`]
            : ['Saldo pendiente'],
    },
    payload.recibo
      ? { label: 'Estado', primary: null, pill: payload.recibo.statusLabel, secondary: [countLabel] }
      : {
          label: 'Conceptos',
          primary: String(payload.itemCount),
          pill: null,
          secondary: [pluralConceptos(payload.itemCount)],
        },
  ];

  const metaPrimaryLines = metaContent.map((column, i) =>
    column.primary ? pen.wrap(column.primary, S.primary, metaColumns[i].width, 2) : [],
  );
  const metaSecondaryLines = metaContent.map((column, i) =>
    column.secondary.flatMap((line) => pen.wrap(line, S.secondary, metaColumns[i].width, 2)),
  );
  const metaColumnHeight = (i: number): number => {
    const blocks: number[] = [LABEL_LINE];
    if (metaContent[i].pill) blocks.push(PILL_HEIGHT);
    if (metaPrimaryLines[i].length) blocks.push(metaPrimaryLines[i].length * normalLineHeight(META.primarySize));
    if (metaSecondaryLines[i].length) blocks.push(metaSecondaryLines[i].length * SECONDARY_LINE);
    return blocks.reduce((sum, h) => sum + h, 0) + META.gap * (blocks.length - 1);
  };
  const metaHeight = Math.max(...metaContent.map((_, i) => metaColumnHeight(i)));

  const doubleRuleHeight = DOUBLE_RULE.marginTop + DOUBLE_RULE.thick + DOUBLE_RULE.gap + DOUBLE_RULE.thin;
  const tableHeaderHeight = LABEL_LINE + TABLE.headerPaddingBottom + TABLE.headerBorder;
  const headerTop = PAGE.paddingTop;
  const firstRuleTop = headerTop + headerHeight;
  const metaTop = firstRuleTop + doubleRuleHeight + META.marginTop;
  const secondRuleTop = metaTop + metaHeight;
  const tableTop = secondRuleTop + doubleRuleHeight + TABLE.marginTop;
  const bodyTop = tableTop + tableHeaderHeight;

  // ---------- measure: columns ----------
  // Numeric columns keep their design width unless a value needs more (as a CSS
  // auto table would), with TABLE.minColumnGap of air before the value.
  const numericColumnWidth = (design: number, header: string, values: string[], style: TextStyle) =>
    Math.max(
      design,
      pen.width(header, S.label) + TABLE.minColumnGap,
      ...values.map((value) => pen.width(value, style) + TABLE.minColumnGap),
    );
  const amountWidth = numericColumnWidth(
    TABLE.amountWidth,
    'IMPORTE',
    payload.items.map((item) => money(item.amount)),
    S.amount,
  );
  const priceWidth = numericColumnWidth(
    TABLE.priceWidth,
    'PRECIO UNITARIO',
    payload.items.map((item) => money(item.unitPrice)),
    S.number,
  );
  const qtyWidth = numericColumnWidth(
    TABLE.qtyWidth,
    'CANTIDAD',
    payload.items.map((item) => formatReceiptQuantity(item.quantity)),
    S.number,
  );
  const COL_AMOUNT_RIGHT = CONTENT_RIGHT;
  const COL_PRICE_RIGHT = COL_AMOUNT_RIGHT - amountWidth;
  const COL_QTY_RIGHT = COL_PRICE_RIGHT - priceWidth;
  const CONCEPT_WIDTH = COL_QTY_RIGHT - qtyWidth - CONTENT_LEFT;

  // ---------- measure: rows ----------
  const indexWidth = pen.width('00', S.index);
  const conceptTextX = CONTENT_LEFT + indexWidth + TABLE.conceptGap;
  const conceptTextWidth = CONCEPT_WIDTH - TABLE.conceptPaddingRight - indexWidth - TABLE.conceptGap;

  const rows: RowLayout[] = payload.items.map((item) => {
    const itemNameLines = pen.wrap(item.name, S.itemName, conceptTextWidth, TABLE.nameMaxLines);
    const descriptionLines = pen.wrap(
      item.description,
      S.itemDescription,
      conceptTextWidth,
      TABLE.descriptionMaxLines,
    );
    const conceptHeight =
      Math.max(itemNameLines.length, 1) * NAME_LINE +
      (descriptionLines.length ? TABLE.descriptionGap + descriptionLines.length * DESCRIPTION_LINE : 0);
    return {
      item,
      nameLines: itemNameLines.length ? itemNameLines : [''],
      descriptionLines,
      height: TABLE.rowPaddingY * 2 + conceptHeight + TABLE.rowBorder,
    };
  });

  // ---------- measure: totals ----------
  const totalsRows: TotalsLayout['rows'] = [{ label: 'Subtotal', value: money(payload.subtotal) }];
  if (payload.adjustment !== null) {
    totalsRows.push({ label: 'Ajuste', value: money(payload.adjustment) });
  }
  totalsRows.push({ label: 'Total', value: money(payload.total) });
  if (payload.paid !== null) {
    totalsRows.push({ label: 'Pagado', value: money(payload.paid) });
  }
  const panelInner = TOTALS.width - TOTALS.paddingX * 2;
  const dueValue = money(payload.bigFigure.value);
  const dueStacked =
    pen.width(payload.bigFigure.label, S.dueLabel) + TOTALS.leaderGap + pen.width(dueValue, S.dueValue) >
    panelInner;
  const dueHeight = dueStacked
    ? normalLineHeight(TOTALS.dueLabelSize) + normalLineHeight(TOTALS.dueValueSize)
    : normalLineHeight(TOTALS.dueValueSize);
  const totals: TotalsLayout = {
    rows: totalsRows,
    due: { label: payload.bigFigure.label, value: dueValue, stacked: dueStacked },
    height:
      TOTALS.paddingY * 2 +
      totalsRows.length * TOTALS_LINE +
      totalsRows.length * TOTALS.rowGap +
      TOTALS.separatorMarginTop +
      1 +
      TOTALS.separatorMarginBottom +
      TOTALS.rowGap +
      dueHeight,
  };

  // ---------- measure: footer (bottom-anchored) ----------
  const footerFr = CONTENT_WIDTH - FOOTER.gap * (FOOTER.columns.length - 1);
  const frUnit = footerFr / FOOTER.columns.reduce((sum, fr) => sum + fr, 0);
  let footerX = CONTENT_LEFT;
  const footerGroups = [
    { label: 'Teléfono', value: payload.company.phone },
    { label: 'Correo', value: payload.company.email },
    { label: 'Dirección', value: payload.company.address },
  ].map((group, i) => {
    const width = FOOTER.columns[i] * frUnit;
    const x = footerX;
    footerX += width + FOOTER.gap;
    return { ...group, x, lines: pen.wrap(group.value, S.footerValue, width, 3) };
  });
  const footerHeight =
    FOOTER.border +
    FOOTER.paddingTop +
    Math.max(
      ...footerGroups.map(
        (group) => FOOTER_LABEL_LINE + FOOTER.groupGap + Math.max(group.lines.length, 1) * FOOTER_LINE,
      ),
    );
  const footerTop = COLOPHON_TOP - COLOPHON.marginTop - footerHeight;
  /** Lowest y the last row may reach so totals still fit above the footer. */
  const lastRowsBottom = footerTop - FOOTER.minSpacer - totals.height - TOTALS.marginTop;

  // ---------- paginate ----------
  const pages: RowLayout[][] = [[]];
  let cursor = bodyTop;
  for (const row of rows) {
    const page = pages[pages.length - 1];
    if (cursor + row.height > ROWS_BOTTOM && page.length > 0) {
      pages.push([row]);
      cursor = bodyTop + row.height;
    } else {
      page.push(row);
      cursor += row.height;
    }
  }
  if (cursor > lastRowsBottom) {
    const last = pages[pages.length - 1];
    if (last.length > 1) {
      const moved = last.pop() as RowLayout;
      pages.push([moved]);
    } else {
      pages.push([]);
    }
  }
  const pageCount = pages.length;

  // ---------- draw ----------
  const drawDoubleRule = (top: number) => {
    const y = top + DOUBLE_RULE.marginTop;
    pen.fillRect(CONTENT_LEFT, y, CONTENT_WIDTH, DOUBLE_RULE.thick, COLORS.ink);
    pen.fillRect(CONTENT_LEFT, y + DOUBLE_RULE.thick + DOUBLE_RULE.gap, CONTENT_WIDTH, DOUBLE_RULE.thin, COLORS.ink);
  };

  const drawHeader = () => {
    // Brand: mark + name/tagline, vertically centered in the brand row.
    const markTop = headerTop + (brand.height - HEADER.logoHeight) / 2;
    if (brand.logo) {
      try {
        doc.addImage(
          brand.logo.dataUrl,
          brand.logo.format,
          pt(CONTENT_LEFT),
          pt(markTop + (HEADER.logoHeight - brand.logo.height) / 2),
          pt(brand.logo.width),
          pt(brand.logo.height),
          undefined,
          'FAST',
        );
      } catch {
        brand.logo = null;
      }
    }
    if (!brand.logo) {
      const r = HEADER.logoHeight / 2;
      doc.setDrawColor(COLORS.ink);
      doc.setLineWidth(pt(HEADER.initialStroke));
      doc.circle(pt(CONTENT_LEFT + r), pt(markTop + r), pt(r - HEADER.initialStroke / 2), 'S');
      pen.text(
        payload.company.initial,
        CONTENT_LEFT + r,
        baselineFrom(markTop + r - normalLineHeight(HEADER.initialSize) / 2, HEADER.initialSize),
        S.initial,
        'center',
      );
    }
    const textX = CONTENT_LEFT + (brand.logo ? brand.logo.width : HEADER.logoHeight) + HEADER.brandGap;
    let textTop = headerTop + (brand.height - brandTextHeight) / 2;
    for (const line of brand.nameLines) {
      pen.text(line, textX, baselineFrom(textTop, HEADER.nameSize), S.name);
      textTop += normalLineHeight(HEADER.nameSize);
    }
    if (brand.tagline) {
      pen.text(brand.tagline, textX, baselineFrom(textTop + HEADER.taglineGap, HEADER.taglineSize), S.tagline);
    }

    // Document block, right-aligned.
    let docTop = headerTop;
    pen.text(
      payload.docTitle,
      CONTENT_RIGHT,
      baselineFrom(docTop, HEADER.titleSize, HEADER.titleSize * HEADER.titleLineHeight),
      S.title,
      'right',
    );
    docTop += HEADER.titleSize * HEADER.titleLineHeight + HEADER.docGap;
    pen.text(`Folio ${payload.folio}`, CONTENT_RIGHT, baselineFrom(docTop, HEADER.folioSize), S.folio, 'right');
    docTop += normalLineHeight(HEADER.folioSize) + HEADER.docGap;
    pen.text(payload.issueDate, CONTENT_RIGHT, baselineFrom(docTop, HEADER.dateSize), S.date, 'right');
  };

  const drawPill = (label: string, x: number, top: number) => {
    const text = label.toUpperCase();
    const width =
      PILL.border * 2 + PILL.paddingX * 2 + PILL.dot + PILL.dotGap + pen.width(text, S.pill);
    doc.setDrawColor(COLORS.ink);
    doc.setLineWidth(pt(PILL.border));
    const inset = PILL.border / 2;
    doc.roundedRect(
      pt(x + inset),
      pt(top + inset),
      pt(width - PILL.border),
      pt(PILL_HEIGHT - PILL.border),
      pt((PILL_HEIGHT - PILL.border) / 2),
      pt((PILL_HEIGHT - PILL.border) / 2),
      'S',
    );
    const centerY = top + PILL_HEIGHT / 2;
    const dotX = x + PILL.border + PILL.paddingX + PILL.dot / 2;
    doc.setFillColor(COLORS.ink);
    doc.circle(pt(dotX), pt(centerY), pt(PILL.dot / 2), 'F');
    pen.text(
      text,
      x + PILL.border + PILL.paddingX + PILL.dot + PILL.dotGap,
      baselineFrom(top + PILL.border + PILL.paddingY, PILL.size),
      S.pill,
    );
  };

  const drawMeta = () => {
    metaColumns.forEach((column, i) => {
      if (column.border) {
        pen.fillRect(column.x - META.columnPadding - META.border, metaTop, META.border, metaHeight, COLORS.hairline);
      }
      const content = metaContent[i];
      let top = metaTop;
      pen.text(content.label.toUpperCase(), column.x, baselineFrom(top, LABEL.size), S.label);
      top += LABEL_LINE + META.gap;
      if (content.pill) {
        drawPill(content.pill, column.x, top);
        top += PILL_HEIGHT + META.gap;
      }
      for (const line of metaPrimaryLines[i]) {
        pen.text(line, column.x, baselineFrom(top, META.primarySize), S.primary);
        top += normalLineHeight(META.primarySize);
      }
      if (metaPrimaryLines[i].length) top += META.gap;
      for (const line of metaSecondaryLines[i]) {
        pen.text(line, column.x, baselineFrom(top, META.secondarySize, SECONDARY_LINE), S.secondary);
        top += SECONDARY_LINE;
      }
    });
  };

  const drawTableHeader = () => {
    const baseline = baselineFrom(tableTop, LABEL.size);
    pen.text('CONCEPTO', CONTENT_LEFT, baseline, S.label);
    pen.text('CANTIDAD', COL_QTY_RIGHT, baseline, S.label, 'right');
    pen.text('PRECIO UNITARIO', COL_PRICE_RIGHT, baseline, S.label, 'right');
    pen.text('IMPORTE', COL_AMOUNT_RIGHT, baseline, S.label, 'right');
    pen.fillRect(
      CONTENT_LEFT,
      tableTop + LABEL_LINE + TABLE.headerPaddingBottom,
      CONTENT_WIDTH,
      TABLE.headerBorder,
      COLORS.ink,
    );
  };

  /** Cells align on the first baseline; the index (padding-top 3) sets it. */
  const rowBaselineOffset = TABLE.indexPaddingTop + fontAscentPx(TABLE.indexSize);

  const drawRow = (row: RowLayout, top: number) => {
    const contentTop = top + TABLE.rowPaddingY;
    const baseline = contentTop + rowBaselineOffset;
    pen.text(row.item.index, CONTENT_LEFT, baseline, S.index);

    let textTop = contentTop;
    for (const line of row.nameLines) {
      pen.text(line, conceptTextX, baselineFrom(textTop, TABLE.nameSize), S.itemName);
      textTop += NAME_LINE;
    }
    if (row.descriptionLines.length) textTop += TABLE.descriptionGap;
    for (const line of row.descriptionLines) {
      pen.text(line, conceptTextX, baselineFrom(textTop, TABLE.descriptionSize), S.itemDescription);
      textTop += DESCRIPTION_LINE;
    }

    pen.text(formatReceiptQuantity(row.item.quantity), COL_QTY_RIGHT, baseline, S.number, 'right');
    pen.text(money(row.item.unitPrice), COL_PRICE_RIGHT, baseline, S.number, 'right');
    pen.text(money(row.item.amount), COL_AMOUNT_RIGHT, baseline, S.amount, 'right');

    const borderY = top + row.height - TABLE.rowBorder / 2;
    pen.hline(CONTENT_LEFT, CONTENT_RIGHT, borderY, COLORS.rowDivider, TABLE.rowBorder, TABLE.rowDash);
  };

  const drawTotals = (top: number) => {
    const left = CONTENT_RIGHT - TOTALS.width;
    pen.fillRect(left, top, TOTALS.width, totals.height, COLORS.panel);
    const innerLeft = left + TOTALS.paddingX;
    const innerRight = CONTENT_RIGHT - TOTALS.paddingX;
    let rowTop = top + TOTALS.paddingY;
    for (const row of totals.rows) {
      const baseline = baselineFrom(rowTop, TOTALS.size);
      pen.text(row.label, innerLeft, baseline, S.totalsLabel);
      pen.text(row.value, innerRight, baseline, S.totalsValue, 'right');
      const leaderStart = innerLeft + pen.width(row.label, S.totalsLabel) + TOTALS.leaderGap;
      const leaderEnd = innerRight - pen.width(row.value, S.totalsValue) - TOTALS.leaderGap;
      if (leaderEnd > leaderStart) {
        pen.hline(leaderStart, leaderEnd, baseline - TOTALS.leaderLift - 0.5, COLORS.leader, 1, TOTALS.leaderDash);
      }
      rowTop += TOTALS_LINE + TOTALS.rowGap;
    }
    const separatorTop = rowTop + TOTALS.separatorMarginTop;
    pen.fillRect(innerLeft, separatorTop, panelInner, 1, COLORS.ink);
    const dueTop = separatorTop + 1 + TOTALS.separatorMarginBottom + TOTALS.rowGap;
    if (totals.due.stacked) {
      pen.text(totals.due.label, innerLeft, baselineFrom(dueTop, TOTALS.dueLabelSize), S.dueLabel);
      pen.text(
        totals.due.value,
        innerRight,
        baselineFrom(dueTop + normalLineHeight(TOTALS.dueLabelSize), TOTALS.dueValueSize),
        S.dueValue,
        'right',
      );
    } else {
      // align-items: baseline — both share the 24px value's baseline.
      const baseline = baselineFrom(dueTop, TOTALS.dueValueSize);
      pen.text(totals.due.label, innerLeft, baseline, S.dueLabel);
      pen.text(totals.due.value, innerRight, baseline, S.dueValue, 'right');
    }
  };

  const drawFooter = () => {
    pen.fillRect(CONTENT_LEFT, footerTop, CONTENT_WIDTH, FOOTER.border, COLORS.ink);
    const groupTop = footerTop + FOOTER.border + FOOTER.paddingTop;
    for (const group of footerGroups) {
      pen.text(group.label.toUpperCase(), group.x, baselineFrom(groupTop, LABEL.size, FOOTER_LABEL_LINE), S.label);
      let lineTop = groupTop + FOOTER_LABEL_LINE + FOOTER.groupGap;
      for (const line of group.lines) {
        pen.text(line, group.x, baselineFrom(lineTop, FOOTER.size, FOOTER_LINE), S.footerValue);
        lineTop += FOOTER_LINE;
      }
    }
  };

  const drawColophon = (pageNumber: number) => {
    const baseline = baselineFrom(COLOPHON_TOP, COLOPHON.size);
    pen.text(
      `${payload.docTitle} ${payload.folio} · Página ${pageNumber} de ${pageCount}`,
      CONTENT_LEFT,
      baseline,
      S.colophon,
    );
    pen.text('Powered by zigzag', CONTENT_RIGHT, baseline, S.colophon, 'right');
  };

  pages.forEach((pageRows, pageIndex) => {
    if (pageIndex > 0) doc.addPage('letter', 'portrait');
    drawHeader();
    drawDoubleRule(firstRuleTop);
    drawMeta();
    drawDoubleRule(secondRuleTop);
    drawTableHeader();
    let top = bodyTop;
    for (const row of pageRows) {
      drawRow(row, top);
      top += row.height;
    }
    if (pageIndex === pageCount - 1) {
      drawTotals(top + TOTALS.marginTop);
      drawFooter();
    }
    drawColophon(pageIndex + 1);
  });

  return doc.output('arraybuffer');
}
