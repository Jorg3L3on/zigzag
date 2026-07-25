import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { isTrustedCompanyLogoUrl } from '@/lib/company-logo-storage';

export const COMPANY_LOGO_FETCH_TIMEOUT_MS = 5_000;
export const COMPANY_LOGO_PDF_MAX_PX = 320;
/** Near-white / near-transparent edge trim so padded marks fill the PDF plate. */
export const COMPANY_LOGO_PDF_TRIM_THRESHOLD = 28;

const extensionToMime = (filePath: string): string | null => {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return null;
};

const bufferToDataUrl = (buffer: Buffer, mimeType: string): string =>
  `data:${mimeType};base64,${buffer.toString('base64')}`;

export const prepareCompanyLogoForPdf = async (
  buffer: Buffer,
): Promise<string | null> => {
  if (buffer.length === 0) {
    return null;
  }

  try {
    const size = COMPANY_LOGO_PDF_MAX_PX;
    const trimmed = await sharp(buffer)
      .rotate()
      .trim({
        background: '#ffffff',
        threshold: COMPANY_LOGO_PDF_TRIM_THRESHOLD,
      })
      .resize({
        width: size,
        height: size,
        fit: 'cover',
        position: 'centre',
      })
      .png()
      .toBuffer();

    const circleMask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/>
      </svg>`,
    );

    const circular = await sharp(trimmed)
      .ensureAlpha()
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png({ compressionLevel: 8 })
      .toBuffer();

    if (circular.length === 0) {
      return null;
    }

    return bufferToDataUrl(circular, 'image/png');
  } catch {
    // Fall back to the original bytes when trim/resize cannot run.
    try {
      const metadata = await sharp(buffer).metadata();
      const mime =
        metadata.format === 'jpeg'
          ? 'image/jpeg'
          : metadata.format === 'webp'
            ? 'image/webp'
            : 'image/png';
      return bufferToDataUrl(buffer, mime);
    } catch {
      return null;
    }
  }
};

const loadLocalPublicLogo = async (
  logoUrl: string,
): Promise<string | null> => {
  if (!logoUrl.startsWith('/') || logoUrl.startsWith('//')) {
    return null;
  }

  const relativePath = logoUrl.replace(/^\//, '');
  const filePath = path.join(process.cwd(), 'public', relativePath);
  const mimeType = extensionToMime(filePath);
  if (!mimeType) {
    return null;
  }

  try {
    const buffer = await readFile(filePath);
    return prepareCompanyLogoForPdf(buffer);
  } catch {
    return null;
  }
};

const loadRemoteLogo = async (logoUrl: string): Promise<string | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    COMPANY_LOGO_FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(logoUrl, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') ?? 'image/png';
    if (!contentType.startsWith('image/')) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return prepareCompanyLogoForPdf(buffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const loadCompanyLogoImageDataUrl = async (
  logoUrl: string | null | undefined,
): Promise<string | null> => {
  if (!isTrustedCompanyLogoUrl(logoUrl)) {
    return null;
  }

  const trimmed = logoUrl!.trim();
  if (trimmed.startsWith('/')) {
    return loadLocalPublicLogo(trimmed);
  }

  return loadRemoteLogo(trimmed);
};
