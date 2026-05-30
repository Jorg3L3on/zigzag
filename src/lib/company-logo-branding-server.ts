import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isTrustedCompanyLogoUrl } from '@/lib/company-logo-storage';

export const COMPANY_LOGO_FETCH_TIMEOUT_MS = 5_000;

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
    return bufferToDataUrl(buffer, mimeType);
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
    if (buffer.length === 0) {
      return null;
    }

    return bufferToDataUrl(buffer, contentType.split(';')[0]?.trim() || 'image/png');
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
