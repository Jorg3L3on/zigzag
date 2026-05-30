import { del, put } from '@vercel/blob';
import {
  type CompanyLogoContentType,
  isTrustedCompanyLogoUrl,
} from '@/lib/company-logo-storage';

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

export const assertBlobTokenConfigured = (): void => {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }
};

export const uploadCompanyLogoBlob = async (
  companyId: number,
  body: Buffer,
  contentType: CompanyLogoContentType,
): Promise<string> => {
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
  if (!isTrustedCompanyLogoUrl(logoUrl) || !logoUrl?.startsWith('https://')) {
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return;
  }

  try {
    await del(logoUrl);
  } catch (error) {
    console.error('Failed to delete company logo blob', error);
  }
};
