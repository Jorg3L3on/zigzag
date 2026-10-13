import { createHash } from 'node:crypto';
import type { buildReceiptPdfPayload } from '@/lib/receipt-pdf/payload';
import { RECEIPT_PDF_RENDERER_VERSION } from '@/lib/receipt-pdf/render';

/**
 * Version of everything the PDF prints: the payload is a pure function of the
 * ticket, its payments, lines and materials and the company (name, address,
 * settings, payment data), the logo URL changes with every upload (Blob adds a
 * suffix) and the renderer version bumps when the layout code changes.
 */
export const buildReceiptPdfEtag = (
  payload: ReturnType<typeof buildReceiptPdfPayload>,
): string => {
  const hash = createHash('sha1')
    .update(RECEIPT_PDF_RENDERER_VERSION)
    .update('\0')
    .update(JSON.stringify(payload))
    .digest('base64url');
  return `"${hash}"`;
};
