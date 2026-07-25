import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { del, put } from '@vercel/blob';
import {
  type CompanyLogoContentType,
  isTrustedCompanyLogoUrl,
} from '@/lib/company-logo-storage';
import { AppError } from '@/lib/errors';

const LOCAL_LOGO_URL_PREFIX = '/company-logos/';

const extensionForContentType = (contentType: CompanyLogoContentType): string => {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
};

const isBlobTokenConfigured = (): boolean =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());

const allowLocalLogoFallback = (): boolean =>
  process.env.NODE_ENV === 'development' && !isBlobTokenConfigured();

export const assertBlobTokenConfigured = (): void => {
  if (!isBlobTokenConfigured()) {
    throw new AppError(
      'El almacenamiento de logos no está configurado. Define BLOB_READ_WRITE_TOKEN en el entorno.',
      503,
      true,
      'CO014',
    );
  }
};

const resolveLocalLogoPath = (logoUrl: string): string | null => {
  if (!logoUrl.startsWith(LOCAL_LOGO_URL_PREFIX)) {
    return null;
  }

  const relative = logoUrl.replace(/^\/+/, '');
  const absolute = path.resolve(process.cwd(), 'public', relative);
  const allowedRoot = path.resolve(process.cwd(), 'public', 'company-logos');
  if (!absolute.startsWith(`${allowedRoot}${path.sep}`)) {
    return null;
  }

  return absolute;
};

const uploadCompanyLogoLocal = async (
  companyId: number,
  body: Buffer,
  contentType: CompanyLogoContentType,
): Promise<string> => {
  const extension = extensionForContentType(contentType);
  const suffix = randomBytes(6).toString('hex');
  const relativeDir = path.join('company-logos', String(companyId));
  const filename = `logo-${suffix}.${extension}`;
  const absoluteDir = path.join(process.cwd(), 'public', relativeDir);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, filename), body);

  const logoUrl = `${LOCAL_LOGO_URL_PREFIX}${companyId}/${filename}`;
  if (!isTrustedCompanyLogoUrl(logoUrl)) {
    throw new Error('Uploaded local logo URL is not trusted');
  }

  return logoUrl;
};

export const uploadCompanyLogoBlob = async (
  companyId: number,
  body: Buffer,
  contentType: CompanyLogoContentType,
): Promise<string> => {
  if (allowLocalLogoFallback()) {
    return uploadCompanyLogoLocal(companyId, body, contentType);
  }

  assertBlobTokenConfigured();
  const extension = extensionForContentType(contentType);
  const pathname = `company-logos/${companyId}/logo.${extension}`;

  const blob = await put(pathname, body, {
    access: 'public',
    contentType,
    addRandomSuffix: true,
  });

  if (!isTrustedCompanyLogoUrl(blob.url)) {
    throw new Error('Uploaded logo URL is not from a trusted origin');
  }

  return blob.url;
};

export const deleteCompanyLogoBlob = async (
  logoUrl: string | null | undefined,
): Promise<void> => {
  if (!isTrustedCompanyLogoUrl(logoUrl) || !logoUrl) {
    return;
  }

  const localPath = resolveLocalLogoPath(logoUrl);
  if (localPath) {
    try {
      await unlink(localPath);
    } catch (error) {
      console.error('Failed to delete local company logo', error);
    }
    return;
  }

  if (!logoUrl.startsWith('https://')) {
    return;
  }

  if (!isBlobTokenConfigured()) {
    return;
  }

  try {
    await del(logoUrl);
  } catch (error) {
    console.error('Failed to delete company logo blob', error);
  }
};
