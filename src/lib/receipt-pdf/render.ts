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
  MATERIALS,
  META,
  NOTES,
  PAGE,
  PILL,
  PX_TO_PT,
  TABLE,
  TOTALS,
  normalLineHeight,
} from './layout';
import {
  formatReceiptAmount,
  formatReceiptMoney,
  formatReceiptQuantity,
  type ReceiptPdfItem,
  type ReceiptPdfPayload,
} from './payload';
import { formatPaymentInfoLine, paymentPdfHeading } from '@/lib/company-payment-info';

/**
 * Bump when the drawing code changes what a PDF looks like: it is part of the
 * invoice route's ETag (ZIG-I20-4), so cached copies are regenerated.
 */
export const RECEIPT_PDF_RENDERER_VERSION = '2026-10-12.1';

export type ReceiptPdfRenderOptions = {
  /** Company logo as a data URL (PNG/JPEG/WEBP); null draws the initial circle. */
  logoDataUrl?: string | null;
  /** Deflate content streams. Tests turn it off to read the text layer. */
  compress?: boolean;
  /** Receives the measured layout (px); tests assert column widths with it. */
  onLayout?: (metrics: ReceiptPdfLayoutMetrics) => void;
};

export type ReceiptPdfLayoutMetrics = {
  conceptWidth: number;
  qtyWidth: number;
  priceWidth: number;
  amountWidth: number;
  /** Currency code left out of table cells to give Concepto room. */
  compactAmounts: boolean;
  /** Numeric text scale (1 = design size). */
  numberScale: number;
  pageCount: number;
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
  primary: { font: RECEIPT_FONTS.sans600, size: META.primarySize, color: COLORS.ink },
  secondary: { font: RECEIPT_FONTS.sans400, size: META.secondarySize, color: COLORS.secondary },
  pill: { font: RECEIPT_FONTS.sans600, size: PILL.size, color: COLORS.ink, tracking: PILL.tracking },
  index: { font: RECEIPT_FONTS.mono400, size: TABLE.indexSize, color: COLORS.hint },
  itemName: { font: RECEIPT_FONTS.sans600, size: TABLE.nameSize, color: COLORS.ink },
  itemDescription: { font: RECEIPT_FONTS.sans400, size: TABLE.descriptionSize, color: COLORS.description },
  number: { font: RECEIPT_FONTS.mono400, size: TABLE.numberSize, color: COLORS.ink },
  amount: { font: RECEIPT_FONTS.mono500, size: TABLE.numberSize, color: COLORS.ink },
  materialName: { font: RECEIPT_FONTS.sans400, size: MATERIALS.size, color: COLORS.secondary },
  materialNumber: { font: RECEIPT_FONTS.mono400, size: MATERIALS.size, color: COLORS.secondary },
  groupLabel: { font: RECEIPT_FONTS.sans400, size: MATERIALS.totalLabelSize, color: COLORS.secondary },
  groupHint: { font: RECEIPT_FONTS.sans400, size: MATERIALS.totalLabelSize, color: COLORS.groupHint },
  /** The design asks for 600; Plex Mono ships 400 and 500 here, so 500. */
  groupValue: { font: RECEIPT_FONTS.mono500, size: MATERIALS.totalValueSize, color: COLORS.ink },
  totalsLabel: { font: RECEIPT_FONTS.sans400, size: TOTALS.size, color: COLORS.muted },
  totalsValue: { font: RECEIPT_FONTS.mono400, size: TOTALS.size, color: COLORS.ink },
  dueLabel: { font: RECEIPT_FONTS.sans600, size: TOTALS.dueLabelSize, color: COLORS.ink },
  dueValue: { font: RECEIPT_FONTS.mono500, size: TOTALS.dueValueSize, color: COLORS.ink },
  notes: { font: RECEIPT_FONTS.sans400, size: NOTES.size, color: COLORS.secondary },
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

  /**
   * Wraps to `maxWidth`. A word wider than the column is broken by characters
   * (jsPDF would leave it overflowing into the next column). With a finite
   * `maxLines` the last kept line gets an ellipsis when text is cut.
   */
  wrap(value: string, style: TextStyle, maxWidth: number, maxLines = Number.POSITIVE_INFINITY): string[] {
    const clean = value.replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    this.use(style);
    const lines = (this.doc.splitTextToSize(clean, pt(maxWidth)) as string[]).flatMap((line) =>
      this.breakLong(line, style, maxWidth),
    );
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = this.ellipsize(`${kept[maxLines - 1]}…`, style, maxWidth);
    return kept;
  }

  /** Splits one line wider than `maxWidth` into pieces that fit, character by character. */
  private breakLong(line: string, style: TextStyle, maxWidth: number): string[] {
    if (this.width(line, style) <= maxWidth) return [line];
    const pieces: string[] = [];
    let current = '';
    for (const char of line) {
      if (current && this.width(current + char, style) > maxWidth) {
        pieces.push(current);
        current = char;
      } else {
        current += char;
      }
    }
    if (current) pieces.push(current);
    return pieces;
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

type MaterialLayout = {
  /** Material name, wrapped over as many lines as it needs. */
  nameLines: string[];
  /** Quantity (and unit when it fits); a long unit goes on lines below the number. */
  qtyLines: string[];
  height: number;
};

type RowLayout = {
  item: ReceiptPdfItem;
  nameLines: string[];
  descriptionLines: string[];
  materials: MaterialLayout[];
  /** `Subtotal {servicio}` (ellipsized) and whether the hint fits after it on the same line. */
  groupLabel: { text: string; hintInline: boolean } | null;
  /** Materials block height, 0 without materials. */
  materialsHeight: number;
  height: number;
};

/** One line of the notes block; `null` text is the gap a blank line leaves. */
type NoteLine = { text: string | null; height: number };

type TotalsLayout = {
  /** Value rows; `thin` is the #d6d6d1 rule between Materiales and Total. */
  rows: Array<{ label: string; value: string } | 'thin'>;
  /** Null on a fully paid recibo: the card ends at Pagado (Jorge, 2026-10-11). */
  due: { label: string; value: string; stacked: boolean } | null;
  height: number;
};

const NAME_LINE = normalLineHeight(TABLE.nameSize);
const DESCRIPTION_LINE = normalLineHeight(TABLE.descriptionSize);
const MATERIAL_LINE = normalLineHeight(MATERIALS.size);
const GROUP_TOTAL_LINE = normalLineHeight(MATERIALS.totalValueSize);
const GROUP_HINT = '(servicio + materiales)';
const NOTES_LINE = NOTES.size * NOTES.lineHeight;

const materialQuantity = (quantity: number, unit: string | null): string =>
  unit ? `${formatReceiptQuantity(quantity)} ${unit}` : formatReceiptQuantity(quantity);
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
  );
  // Title and folio only: the issue date lives in Fecha de emisión (CHANGES-v2 §1).
  const docBlockHeight =
    HEADER.titleSize * HEADER.titleLineHeight + HEADER.docGap + normalLineHeight(HEADER.folioSize);

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
      ? {
          label: 'Estado',
          primary: null,
          pill: payload.recibo.statusLabel,
          // A converted ticket names the presupuesto it came from (ZIG-I26-2).
          secondary: payload.sourcePresupuestoFolio
            ? [countLabel, `Presupuesto ${payload.sourcePresupuestoFolio}`]
            : [countLabel],
        }
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
  // auto table would), with TABLE.minColumnGap of air before the value. When
  // that would leave Concepto under minConceptShare of the table (10-digit
  // amounts), the currency code leaves the cells, then the numbers shrink.
  const scaled = (style: TextStyle, factor: number): TextStyle => ({ ...style, size: style.size * factor });
  const minConceptWidth = CONTENT_WIDTH * TABLE.minConceptShare;
  const hasUnit = (material: ReceiptPdfItem['materials'][number]) => Boolean(material.unit);
  const qtyWithUnit = (material: ReceiptPdfItem['materials'][number]) =>
    materialQuantity(material.quantity, material.unit);
  const columnWidths = (compact: boolean, factor: number) => {
    const fmt = (value: number) => (compact ? formatReceiptAmount(value) : money(value));
    const numeric = (
      design: number,
      header: string,
      values: string[],
      style: TextStyle,
      materialValues: string[],
    ) =>
      Math.max(
        design,
        pen.width(header, S.label) + TABLE.minColumnGap,
        ...values.map((value) => pen.width(value, scaled(style, factor)) + TABLE.minColumnGap),
        ...materialValues.map(
          (value) => pen.width(value, scaled(S.materialNumber, factor)) + TABLE.minColumnGap,
        ),
      );
    const materials = payload.items.flatMap((item) => item.materials);
    // A quantity with its unit widens the column only while it stays compact.
    const qtyMaterialValues = [
      ...materials.map((material) => formatReceiptQuantity(material.quantity)),
      ...materials
        .filter(hasUnit)
        .map(qtyWithUnit)
        .filter(
          (value) =>
            pen.width(value, scaled(S.materialNumber, factor)) + TABLE.minColumnGap <= TABLE.qtyMaxWidth,
        ),
    ];
    return {
      fmt,
      // The group subtotal sits in the Importe column too.
      amount: Math.max(
        numeric(
          TABLE.amountWidth,
          'IMPORTE',
          payload.items.map((item) => fmt(item.amount)),
          S.amount,
          materials.map((material) => fmt(material.amount)),
        ),
        ...payload.items
          .filter((item) => item.materials.length > 0)
          .map((item) => pen.width(fmt(item.groupTotal), scaled(S.groupValue, factor)) + TABLE.minColumnGap),
      ),
      price: numeric(
        TABLE.priceWidth,
        'PRECIO UNITARIO',
        payload.items.map((item) => fmt(item.unitPrice)),
        S.number,
        materials.map((material) => fmt(material.unitPrice)),
      ),
      qty: Math.min(
        numeric(
          TABLE.qtyWidth,
          'CANTIDAD',
          payload.items.map((item) => formatReceiptQuantity(item.quantity)),
          S.number,
          qtyMaterialValues,
        ),
        TABLE.qtyMaxWidth,
      ),
      factor,
      compact,
    };
  };
  const conceptWidthOf = (c: { amount: number; price: number; qty: number }) =>
    CONTENT_WIDTH - c.amount - c.price - c.qty;
  let columns = columnWidths(false, 1);
  if (conceptWidthOf(columns) < minConceptWidth) {
    columns = columnWidths(true, 1);
    for (let factor = 0.95; conceptWidthOf(columns) < minConceptWidth && factor >= TABLE.minNumberScale - 1e-9; factor -= 0.05) {
      columns = columnWidths(true, factor);
    }
  }
  const cell = columns.fmt;
  const numberStyle = scaled(S.number, columns.factor);
  const amountStyle = scaled(S.amount, columns.factor);
  const materialNumberStyle = scaled(S.materialNumber, columns.factor);
  const groupValueStyle = scaled(S.groupValue, columns.factor);
  const COL_AMOUNT_RIGHT = CONTENT_RIGHT;
  const COL_PRICE_RIGHT = COL_AMOUNT_RIGHT - columns.amount;
  const COL_QTY_RIGHT = COL_PRICE_RIGHT - columns.price;
  const CONCEPT_WIDTH = COL_QTY_RIGHT - columns.qty - CONTENT_LEFT;
  /** Width a quantity may use inside its column, minus the air kept on the left. */
  const qtyTextWidth = columns.qty - TABLE.minColumnGap / 2;

  // ---------- measure: rows ----------
  const indexWidth = pen.width('00', S.index);
  const conceptTextX = CONTENT_LEFT + indexWidth + TABLE.conceptGap;
  const conceptTextWidth = CONCEPT_WIDTH - TABLE.conceptPaddingRight - indexWidth - TABLE.conceptGap;

  // Materials block (CHANGES-v2 §2): its own grid from the indented left edge to
  // the same numeric columns as the table, so amounts line up with Importe.
  const materialsLeft = CONTENT_LEFT + MATERIALS.indent;
  const materialsTextX = materialsLeft + MATERIALS.border + MATERIALS.paddingLeft;
  const materialNameWidth = COL_QTY_RIGHT - columns.qty - materialsTextX - TABLE.conceptPaddingRight;
  const groupLabelWidth = COL_AMOUNT_RIGHT - columns.amount - materialsTextX - TABLE.conceptPaddingRight;
  const groupHintWidth = pen.width(` ${GROUP_HINT}`, S.groupHint);

  const rows: RowLayout[] = payload.items.map((item) => {
    const itemNameLines = pen.wrap(item.name, S.itemName, conceptTextWidth);
    const descriptionLines = pen.wrap(item.description, S.itemDescription, conceptTextWidth);
    const materials: MaterialLayout[] = item.materials.map((material) => {
      const nameLines = pen.wrap(material.name, S.materialName, materialNameWidth);
      const combined = materialQuantity(material.quantity, material.unit);
      const qtyLines =
        !material.unit || pen.width(combined, materialNumberStyle) <= qtyTextWidth
          ? [combined]
          : [
              formatReceiptQuantity(material.quantity),
              ...pen.wrap(material.unit, materialNumberStyle, qtyTextWidth),
            ];
      return {
        nameLines: nameLines.length ? nameLines : [''],
        qtyLines,
        height: Math.max(nameLines.length, qtyLines.length, 1) * MATERIAL_LINE,
      };
    });
    let groupLabel: RowLayout['groupLabel'] = null;
    let materialsHeight = 0;
    if (materials.length) {
      // One line: the service name gives way first; the hint drops below only
      // when even an ellipsized name leaves it no room.
      const full = `Subtotal ${item.name}`;
      const hintInline = pen.width('Subtotal …', S.groupLabel) + groupHintWidth <= groupLabelWidth;
      const text = pen.ellipsize(full, S.groupLabel, groupLabelWidth - (hintInline ? groupHintWidth : 0));
      groupLabel = { text, hintInline };
      const groupTotalHeight =
        MATERIALS.totalBorder +
        MATERIALS.totalPaddingTop +
        GROUP_TOTAL_LINE +
        (hintInline ? 0 : normalLineHeight(MATERIALS.totalLabelSize));
      materialsHeight =
        LABEL_LINE +
        materials.reduce((sum, material) => sum + MATERIALS.gap + material.height, 0) +
        MATERIALS.gap +
        groupTotalHeight;
    }
    const conceptHeight =
      Math.max(itemNameLines.length, 1) * NAME_LINE +
      (descriptionLines.length ? TABLE.descriptionGap + descriptionLines.length * DESCRIPTION_LINE : 0);
    return {
      item,
      nameLines: itemNameLines.length ? itemNameLines : [''],
      descriptionLines,
      materials,
      groupLabel,
      materialsHeight,
      height:
        TABLE.rowPaddingTop +
        conceptHeight +
        (materialsHeight ? MATERIALS.marginTop + materialsHeight : 0) +
        TABLE.rowPaddingBottom +
        TABLE.rowBorder,
    };
  });

  // ---------- measure: totals ----------
  // CHANGES-v2 §3: Servicios, Materiales, thin rule, Total, Pagado; no Subtotal.
  // A presupuesto's big figure is the total, so it skips the Total row and rule.
  const totalsRows: TotalsLayout['rows'] = [
    { label: 'Servicios', value: money(payload.servicesSubtotal) },
    { label: 'Materiales', value: money(payload.materialsSubtotal) },
  ];
  if (payload.adjustment !== null) {
    totalsRows.push({ label: 'Ajuste', value: money(payload.adjustment) });
  }
  if (payload.paid !== null) {
    totalsRows.push('thin', { label: 'Total', value: money(payload.total) });
    totalsRows.push({ label: 'Pagado', value: money(payload.paid) });
  }
  const THIN_SEPARATOR = TOTALS.thinSeparatorMargin * 2 + 1;
  const panelInner = TOTALS.width - TOTALS.paddingX * 2;
  const dueValue = money(payload.bigFigure.value);
  const dueStacked =
    pen.width(payload.bigFigure.label, S.dueLabel) + TOTALS.leaderGap + pen.width(dueValue, S.dueValue) >
    panelInner;
  // A 10-digit figure is scaled down to the panel instead of overflowing it.
  const dueScale = Math.min(1, panelInner / Math.max(pen.width(dueValue, S.dueValue), 1));
  const dueValueStyle = scaled(S.dueValue, dueScale);
  const dueValueSize = TOTALS.dueValueSize * dueScale;
  const dueHeight = dueStacked
    ? normalLineHeight(TOTALS.dueLabelSize) + normalLineHeight(dueValueSize)
    : normalLineHeight(TOTALS.dueValueSize);
  const showDue = payload.recibo?.statusLabel !== 'Pagado';
  const rowsHeight =
    totalsRows.reduce((sum, row) => sum + (row === 'thin' ? THIN_SEPARATOR : TOTALS_LINE), 0) +
    (totalsRows.length - 1) * TOTALS.rowGap;
  const totals: TotalsLayout = {
    rows: totalsRows,
    due: showDue ? { label: payload.bigFigure.label, value: dueValue, stacked: dueStacked } : null,
    height:
      TOTALS.paddingY * 2 +
      rowsHeight +
      (showDue
        ? TOTALS.rowGap +
          TOTALS.separatorMarginTop +
          1 +
          TOTALS.separatorMarginBottom +
          TOTALS.rowGap +
          dueHeight
        : 0),
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
  // Para pagar por transferencia (ZIG-I20-1): one labelled block above the
  // contact groups, so the footer grows and pagination makes room for it.
  const paymentLines: string[] = payload.payment
    ? [
        ...pen.wrap(formatPaymentInfoLine(payload.payment), S.footerValue, CONTENT_WIDTH, 2),
        ...(payload.payment.note
          ? pen.wrap(payload.payment.note, S.footerValue, CONTENT_WIDTH, 2)
          : []),
      ]
    : [];
  const paymentHeight =
    paymentLines.length > 0
      ? FOOTER_LABEL_LINE + FOOTER.groupGap + paymentLines.length * FOOTER_LINE + FOOTER.paymentGap
      : 0;
  const footerHeight =
    FOOTER.border +
    FOOTER.paddingTop +
    paymentHeight +
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
  /** Page that carries the totals panel; notes-only pages follow it. */
  const totalsPageIndex = pages.length - 1;
  const rowsEnd = bodyTop + pages[totalsPageIndex].reduce((sum, row) => sum + row.height, 0);
  const totalsTop = rowsEnd + TOTALS.marginTop;

  // ---------- measure + paginate: notes ----------
  const noteLines: NoteLine[] = [];
  for (const paragraph of (payload.notes ?? '').split('\n')) {
    if (paragraph.trim() === '') {
      if (noteLines.length > 0 && noteLines[noteLines.length - 1].text !== null) {
        noteLines.push({ text: null, height: NOTES.paragraphGap });
      }
      continue;
    }
    for (const line of pen.wrap(paragraph, S.notes, CONTENT_WIDTH)) {
      noteLines.push({ text: line, height: NOTES_LINE });
    }
  }
  while (noteLines.length > 0 && noteLines[noteLines.length - 1].text === null) noteLines.pop();
  const notesLabel = payload.docType === 'presupuesto' ? 'Condiciones y notas' : 'Notas';
  const NOTES_LABEL_BLOCK = LABEL_LINE + NOTES.labelGap;

  /** Note lines per page index; pages past the rows hold notes only. */
  const notesByPage = new Map<number, NoteLine[]>();
  /** Top of the notes label on each page that has notes. */
  const notesTopByPage = new Map<number, number>();
  if (noteLines.length > 0) {
    let pageIndex = totalsPageIndex;
    let top = totalsTop + totals.height + NOTES.marginTop;
    let remaining = [...noteLines];
    while (remaining.length > 0) {
      const room = ROWS_BOTTOM - top - NOTES_LABEL_BLOCK;
      let used = 0;
      let count = 0;
      while (count < remaining.length && used + remaining[count].height <= room) {
        used += remaining[count].height;
        count += 1;
      }
      const minimum = Math.min(NOTES.minLines, remaining.length);
      const textLinesFit = remaining.slice(0, count).filter((line) => line.text !== null).length;
      if (textLinesFit < minimum) {
        // Not even the label plus a couple of lines: start on a fresh page.
        pageIndex += 1;
        top = tableTop;
        continue;
      }
      notesByPage.set(pageIndex, remaining.slice(0, count));
      notesTopByPage.set(pageIndex, top);
      remaining = remaining.slice(count);
      while (remaining.length > 0 && remaining[0].text === null) remaining.shift();
      if (remaining.length > 0) {
        pageIndex += 1;
        top = tableTop;
      }
    }
    // The last page also carries the footer: pull lines forward until it clears it.
    const finalIndex = Math.max(...notesByPage.keys());
    const finalLines = notesByPage.get(finalIndex) as NoteLine[];
    const finalTop = notesTopByPage.get(finalIndex) as number;
    const footerLimit = footerTop - FOOTER.minSpacer;
    const heightOf = (lines: NoteLine[]) => lines.reduce((sum, line) => sum + line.height, 0);
    if (finalTop + NOTES_LABEL_BLOCK + heightOf(finalLines) > footerLimit) {
      const overflow: NoteLine[] = [];
      while (
        finalLines.length > 0 &&
        finalTop + NOTES_LABEL_BLOCK + heightOf(finalLines) > footerLimit
      ) {
        overflow.unshift(finalLines.pop() as NoteLine);
      }
      while (overflow.length > 0 && overflow[0].text === null) overflow.shift();
      // Never strand a single line on the next page: carry one more over with it.
      const textLines = (lines: NoteLine[]) => lines.filter((line) => line.text !== null).length;
      while (
        overflow.length > 0 &&
        textLines(overflow) < NOTES.minLines &&
        textLines(finalLines) > NOTES.minLines
      ) {
        overflow.unshift(finalLines.pop() as NoteLine);
        while (finalLines.length > 0 && finalLines[finalLines.length - 1].text === null) {
          overflow.unshift(finalLines.pop() as NoteLine);
        }
      }
      while (overflow.length > 0 && overflow[0].text === null) overflow.shift();
      if (finalLines.filter((line) => line.text !== null).length < Math.min(NOTES.minLines, noteLines.length)) {
        overflow.unshift(...finalLines.splice(0));
      }
      if (finalLines.length === 0) {
        notesByPage.delete(finalIndex);
        notesTopByPage.delete(finalIndex);
      }
      if (overflow.length > 0) {
        notesByPage.set(finalIndex + 1, overflow);
        notesTopByPage.set(finalIndex + 1, tableTop);
      }
    }
  }
  const pageCount = Math.max(pages.length, ...[...notesByPage.keys()].map((index) => index + 1));

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
    const contentTop = top + TABLE.rowPaddingTop;
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

    pen.text(formatReceiptQuantity(row.item.quantity), COL_QTY_RIGHT, baseline, numberStyle, 'right');
    pen.text(cell(row.item.unitPrice), COL_PRICE_RIGHT, baseline, numberStyle, 'right');
    pen.text(cell(row.item.amount), COL_AMOUNT_RIGHT, baseline, amountStyle, 'right');
    if (row.groupLabel) {
      // Materials block: left rule, MATERIALES, one grid row per material, group subtotal.
      let blockTop = textTop + MATERIALS.marginTop;
      pen.fillRect(materialsLeft, blockTop, MATERIALS.border, row.materialsHeight, COLORS.rowDivider);
      pen.text('MATERIALES', materialsTextX, baselineFrom(blockTop, LABEL.size), S.label);
      blockTop += LABEL_LINE;
      row.item.materials.forEach((material, i) => {
        const layout = row.materials[i];
        blockTop += MATERIALS.gap;
        const lineBaseline = (lineIndex: number) =>
          baselineFrom(blockTop + lineIndex * MATERIAL_LINE, MATERIALS.size);
        layout.nameLines.forEach((line, lineIndex) => {
          pen.text(line, materialsTextX, lineBaseline(lineIndex), S.materialName);
        });
        layout.qtyLines.forEach((line, lineIndex) => {
          pen.text(line, COL_QTY_RIGHT, lineBaseline(lineIndex), materialNumberStyle, 'right');
        });
        pen.text(cell(material.unitPrice), COL_PRICE_RIGHT, lineBaseline(0), materialNumberStyle, 'right');
        pen.text(cell(material.amount), COL_AMOUNT_RIGHT, lineBaseline(0), materialNumberStyle, 'right');
        blockTop += layout.height;
      });
      blockTop += MATERIALS.gap;
      pen.hline(
        materialsTextX,
        CONTENT_RIGHT,
        blockTop + MATERIALS.totalBorder / 2,
        COLORS.groupRule,
        MATERIALS.totalBorder,
        MATERIALS.totalDash,
      );
      // align-items: baseline on the 13px value's line box.
      const totalBaseline = baselineFrom(
        blockTop + MATERIALS.totalBorder + MATERIALS.totalPaddingTop,
        MATERIALS.totalValueSize,
      );
      pen.text(row.groupLabel.text, materialsTextX, totalBaseline, S.groupLabel);
      const hintX = row.groupLabel.hintInline
        ? materialsTextX + pen.width(`${row.groupLabel.text} `, S.groupLabel)
        : materialsTextX;
      const hintBaseline = row.groupLabel.hintInline
        ? totalBaseline
        : totalBaseline + normalLineHeight(MATERIALS.totalLabelSize);
      pen.text(GROUP_HINT, hintX, hintBaseline, S.groupHint);
      pen.text(cell(row.item.groupTotal), COL_AMOUNT_RIGHT, totalBaseline, groupValueStyle, 'right');
    }

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
      if (row === 'thin') {
        pen.fillRect(innerLeft, rowTop + TOTALS.thinSeparatorMargin, panelInner, 1, COLORS.rowDivider);
        rowTop += THIN_SEPARATOR + TOTALS.rowGap;
        continue;
      }
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
    if (!totals.due) return;
    const separatorTop = rowTop + TOTALS.separatorMarginTop;
    pen.fillRect(innerLeft, separatorTop, panelInner, 1, COLORS.ink);
    const dueTop = separatorTop + 1 + TOTALS.separatorMarginBottom + TOTALS.rowGap;
    if (totals.due.stacked) {
      pen.text(totals.due.label, innerLeft, baselineFrom(dueTop, TOTALS.dueLabelSize), S.dueLabel);
      pen.text(
        totals.due.value,
        innerRight,
        baselineFrom(dueTop + normalLineHeight(TOTALS.dueLabelSize), dueValueSize),
        dueValueStyle,
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
    let groupTop = footerTop + FOOTER.border + FOOTER.paddingTop;
    const payment = payload.payment;
    if (payment && paymentLines.length > 0) {
      pen.text(
        paymentPdfHeading(payment),
        CONTENT_LEFT,
        baselineFrom(groupTop, LABEL.size, FOOTER_LABEL_LINE),
        S.label,
      );
      let lineTop = groupTop + FOOTER_LABEL_LINE + FOOTER.groupGap;
      for (const line of paymentLines) {
        pen.text(line, CONTENT_LEFT, baselineFrom(lineTop, FOOTER.size, FOOTER_LINE), S.footerValue);
        lineTop += FOOTER_LINE;
      }
      groupTop += paymentHeight;
    }
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

  const drawNotes = (pageIndex: number) => {
    const lines = notesByPage.get(pageIndex);
    if (!lines) return;
    let top = notesTopByPage.get(pageIndex) as number;
    const continued = pageIndex > Math.min(...notesByPage.keys());
    const label = continued ? `${notesLabel} (cont.)` : notesLabel;
    pen.text(label.toUpperCase(), CONTENT_LEFT, baselineFrom(top, LABEL.size), S.label);
    top += NOTES_LABEL_BLOCK;
    for (const line of lines) {
      if (line.text !== null) {
        pen.text(line.text, CONTENT_LEFT, baselineFrom(top, NOTES.size, NOTES_LINE), S.notes);
      }
      top += line.height;
    }
  };

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    if (pageIndex > 0) doc.addPage('letter', 'portrait');
    drawHeader();
    drawDoubleRule(firstRuleTop);
    drawMeta();
    drawDoubleRule(secondRuleTop);
    if (pageIndex <= totalsPageIndex) {
      drawTableHeader();
      let top = bodyTop;
      for (const row of pages[pageIndex]) {
        drawRow(row, top);
        top += row.height;
      }
      if (pageIndex === totalsPageIndex) drawTotals(totalsTop);
    }
    drawNotes(pageIndex);
    if (pageIndex === pageCount - 1) drawFooter();
    drawColophon(pageIndex + 1);
  }

  options.onLayout?.({
    conceptWidth: CONCEPT_WIDTH,
    qtyWidth: columns.qty,
    priceWidth: columns.price,
    amountWidth: columns.amount,
    compactAmounts: columns.compact,
    numberScale: columns.factor,
    pageCount,
  });
  return doc.output('arraybuffer');
}
