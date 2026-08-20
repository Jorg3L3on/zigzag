/**
 * On-device simple receipt image for offline share (canvas, monochrome).
 */

import { buildOfflineReceiptText, type OfflineReceiptInput } from '@/lib/whatsapp-share';

const RECEIPT_WIDTH = 720;
const LINE_HEIGHT = 36;
const PADDING = 32;

export const buildOfflineReceiptFileName = (
  input: OfflineReceiptInput,
): string => {
  const id = input.ticketId ?? input.localJobId ?? 'local';
  const safe = String(id).replace(/[^\w\-]+/g, '_');
  return `recibo_simple_${safe}.png`;
};

/**
 * Renders a lightweight monochrome receipt PNG as a File for navigator.share.
 * Returns null when canvas / OffscreenCanvas is unavailable.
 */
export const buildOfflineReceiptImageFile = async (
  input: OfflineReceiptInput,
): Promise<File | null> => {
  if (typeof document === 'undefined') {
    return null;
  }

  const text = buildOfflineReceiptText(input);
  const lines = text.split('\n');
  const height = PADDING * 2 + lines.length * LINE_HEIGHT + 24;

  const canvas = document.createElement('canvas');
  canvas.width = RECEIPT_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, RECEIPT_WIDTH, height);
  ctx.fillStyle = '#111111';
  ctx.font = '600 28px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'top';

  let y = PADDING;
  for (const line of lines) {
    const isHeader = line.includes('RECIBO SIMPLE');
    ctx.font = isHeader
      ? '700 32px ui-sans-serif, system-ui, sans-serif'
      : '500 26px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(line, PADDING, y, RECEIPT_WIDTH - PADDING * 2);
    y += LINE_HEIGHT;
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/png');
  });
  if (!blob) {
    return null;
  }

  return new File([blob], buildOfflineReceiptFileName(input), {
    type: 'image/png',
  });
};

const canShareFile = (file: File): boolean =>
  typeof navigator !== 'undefined' &&
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [file] });

export type OfflineReceiptShareResult =
  | 'shared'
  | 'whatsapp'
  | 'copied'
  | 'dismissed';

/**
 * Prefer image share sheet; fall back to opening wa.me text href when provided.
 */
export const deliverOfflineReceipt = async (options: {
  input: OfflineReceiptInput;
  whatsappHref?: string | null;
}): Promise<OfflineReceiptShareResult> => {
  const file = await buildOfflineReceiptImageFile(options.input);
  if (file && canShareFile(file) && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        files: [file],
        title: 'Recibo simple',
        text: buildOfflineReceiptText(options.input),
      });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'dismissed';
      }
    }
  }

  if (options.whatsappHref && typeof window !== 'undefined') {
    window.open(options.whatsappHref, '_blank', 'noopener,noreferrer');
    return 'whatsapp';
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(buildOfflineReceiptText(options.input));
    return 'copied';
  }

  return 'dismissed';
};
