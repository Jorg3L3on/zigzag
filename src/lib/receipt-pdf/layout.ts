/**
 * Design 2a measurements (docs/pdf-design-2a/README.md, receipt-template.html).
 * Everything is in CSS px at 96 dpi, as in the design; the renderer converts
 * with PX_TO_PT. The fidelity pass tweaks this file only.
 */

export const PX_TO_PT = 0.75;

/** IBM Plex Sans and Mono share hhea metrics: ascender 1025, descender -275, line gap 0. */
export const FONT_ASCENT = 1.025;
export const FONT_DESCENT = 0.275;

/** Chrome rounds ascent and descent to whole px when it sizes a `normal` line box. */
export const fontAscentPx = (size: number): number => Math.round(size * FONT_ASCENT);
export const fontDescentPx = (size: number): number => Math.round(size * FONT_DESCENT);
export const normalLineHeight = (size: number): number => fontAscentPx(size) + fontDescentPx(size);

/** Baseline of the first line of a line box that starts at `top` (CSS half-leading model). */
export const baselineFrom = (top: number, size: number, lineHeight = normalLineHeight(size)): number =>
  top + (lineHeight - normalLineHeight(size)) / 2 + fontAscentPx(size);

export const PAGE = {
  width: 816,
  height: 1056,
  paddingTop: 56,
  paddingX: 64,
  paddingBottom: 48,
} as const;

export const CONTENT_LEFT = PAGE.paddingX;
export const CONTENT_RIGHT = PAGE.width - PAGE.paddingX;
export const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
export const CONTENT_BOTTOM = PAGE.height - PAGE.paddingBottom;

export const COLORS = {
  ink: '#141414',
  secondary: '#444444',
  muted: '#555555',
  description: '#666666',
  label: '#777777',
  hint: '#999999',
  hairline: '#e2e2de',
  rowDivider: '#d6d6d1',
  leader: '#aaaaaa',
  panel: '#f4f4f1',
  white: '#ffffff',
} as const;

/** Section labels: 10px uppercase, .14em tracking, #777. */
export const LABEL = { size: 10, tracking: 0.14 } as const;

export const HEADER = {
  logoHeight: 44,
  logoMaxWidth: 160,
  initialStroke: 1.5,
  initialSize: 16,
  brandGap: 14,
  nameSize: 15,
  taglineSize: 11.5,
  taglineGap: 3,
  titleSize: 34,
  titleTracking: -0.02,
  titleLineHeight: 1,
  docGap: 8,
  folioSize: 12,
  dateSize: 12,
} as const;

export const DOUBLE_RULE = {
  marginTop: 32,
  thick: 2,
  gap: 3,
  thin: 1,
} as const;

export const META = {
  marginTop: 28,
  columnPadding: 24,
  border: 1,
  gap: 8,
  primarySize: 15,
  secondarySize: 13,
  secondaryLineHeight: 1.5,
} as const;

export const PILL = {
  size: 11,
  tracking: 0.1,
  paddingY: 4,
  paddingX: 10,
  border: 1,
  dot: 6,
  dotGap: 7,
} as const;

export const TABLE = {
  marginTop: 12,
  qtyWidth: 80,
  priceWidth: 130,
  amountWidth: 120,
  /** Air kept left of the widest value when a numeric column has to grow. */
  minColumnGap: 16,
  headerPaddingBottom: 10,
  headerBorder: 1,
  rowPaddingY: 16,
  rowBorder: 1,
  /** Chrome draws a 1px dashed border as 3px dashes with 3px gaps. */
  rowDash: [3, 3] as const,
  conceptPaddingRight: 16,
  conceptGap: 12,
  indexSize: 11,
  indexPaddingTop: 3,
  nameSize: 14,
  nameMaxLines: 2,
  descriptionSize: 12.5,
  descriptionGap: 3,
  descriptionMaxLines: 3,
  numberSize: 13,
} as const;

export const TOTALS = {
  marginTop: 28,
  width: 320,
  paddingY: 18,
  paddingX: 20,
  rowGap: 10,
  size: 13,
  leaderGap: 8,
  /** The dotted leader sits 3px above the baseline (translateY(-3px)). */
  leaderLift: 3,
  leaderDash: [1, 1] as const,
  separatorMarginTop: 6,
  separatorMarginBottom: 2,
  dueLabelSize: 14,
  dueValueSize: 24,
} as const;

export const FOOTER = {
  /** grid-template-columns: 1fr 1.2fr 2fr */
  columns: [1, 1.2, 2] as const,
  gap: 24,
  border: 1,
  paddingTop: 16,
  size: 12,
  lineHeight: 1.45,
  groupGap: 4,
  /** Keeps the totals panel off the footer when the page is full. */
  minSpacer: 16,
} as const;

export const COLOPHON = {
  marginTop: 18,
  size: 10,
  tracking: 0.04,
} as const;
