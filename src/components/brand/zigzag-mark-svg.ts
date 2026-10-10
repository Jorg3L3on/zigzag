/**
 * Geometry of the ZigZag mark (receipt with a Z cut out), shared by the React
 * component and the social cards. Mirrors the exports in `assets/brand/`; the
 * tests assert the generated SVG matches those files byte for byte.
 */
export const ZIGZAG_GRADIENT_FROM = '#FFB224';
export const ZIGZAG_GRADIENT_TO = '#E8482E';

export const ZIGZAG_RECEIPT_PATH =
  'M22 10L30 16L38 10L46 16L54 10L62 16L70 10L78 16V84L70 90L62 84L54 90L46 84L38 90L30 84L22 90Z';
export const ZIGZAG_Z_PATH = 'M34 36H66L34 64H66';

/** Receipt scale inside the square/rounded icons (white receipt on the gradient). */
export const ZIGZAG_ICON_INSET_TRANSFORM = 'translate(16 16) scale(.68)';
export const ZIGZAG_ICON_RADIUS = 22;

/** `mark`: gradient receipt on transparent. `rounded`/`square`: white receipt on a gradient tile. */
export type ZigZagMarkVariant = 'mark' | 'rounded' | 'square';

const defs = (gradientId: string, maskId: string) =>
  `<defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${ZIGZAG_GRADIENT_FROM}"></stop><stop offset="1" stop-color="${ZIGZAG_GRADIENT_TO}"></stop></linearGradient><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><path d="${ZIGZAG_RECEIPT_PATH}" fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round"></path><path d="${ZIGZAG_Z_PATH}" fill="none" stroke="#000" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"></path></mask></defs>`;

/** Standalone SVG markup (same as `assets/brand/zigzag-<variant>.svg`). */
export const zigzagMarkSvg = (variant: ZigZagMarkVariant = 'rounded') => {
  const body =
    variant === 'mark'
      ? '<rect width="100" height="100" fill="url(#g)" mask="url(#m)"></rect>'
      : `<rect width="100" height="100"${
          variant === 'rounded' ? ` rx="${ZIGZAG_ICON_RADIUS}"` : ''
        } fill="url(#g)"></rect><g transform="${ZIGZAG_ICON_INSET_TRANSFORM}"><rect width="100" height="100" fill="#fff" mask="url(#m)"></rect></g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${defs('g', 'm')}${body}</svg>`;
};

/** Data URL for `<img>` in places that cannot render inline SVG masks (next/og). */
export const zigzagMarkDataUrl = (variant: ZigZagMarkVariant = 'rounded') =>
  `data:image/svg+xml;base64,${btoa(zigzagMarkSvg(variant))}`;
