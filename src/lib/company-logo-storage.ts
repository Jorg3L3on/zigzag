export const COMPANY_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const COMPANY_LOGO_MIN_DIMENSION = 64;
export const COMPANY_LOGO_MAX_DIMENSION = 1024;

export const COMPANY_LOGO_ALLOWED_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type CompanyLogoContentType =
  (typeof COMPANY_LOGO_ALLOWED_CONTENT_TYPES)[number];

export type CompanyLogoValidationInput = {
  contentType: string;
  size: number;
  width: number;
  height: number;
};

export type CompanyLogoValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

const BLOB_HOST_SUFFIXES = [
  '.blob.vercel-storage.com',
  '.public.blob.vercel-storage.com',
] as const;

const LEGACY_STATIC_LOGO_PREFIXES = ['/icons/'] as const;

export const validateCompanyLogoUpload = (
  input: CompanyLogoValidationInput,
): CompanyLogoValidationResult => {
  if (
    !COMPANY_LOGO_ALLOWED_CONTENT_TYPES.includes(
      input.contentType as CompanyLogoContentType,
    )
  ) {
    return {
      ok: false,
      reason: 'Formato no permitido. Usa PNG, JPEG o WebP.',
    };
  }

  if (input.size <= 0 || input.size > COMPANY_LOGO_MAX_BYTES) {
    return {
      ok: false,
      reason: 'El archivo debe pesar entre 1 byte y 2 MB.',
    };
  }

  if (
    input.width < COMPANY_LOGO_MIN_DIMENSION ||
    input.height < COMPANY_LOGO_MIN_DIMENSION
  ) {
    return {
      ok: false,
      reason: `La imagen debe medir al menos ${COMPANY_LOGO_MIN_DIMENSION}px por lado.`,
    };
  }

  if (
    input.width > COMPANY_LOGO_MAX_DIMENSION ||
    input.height > COMPANY_LOGO_MAX_DIMENSION
  ) {
    return {
      ok: false,
      reason: `La imagen no puede superar ${COMPANY_LOGO_MAX_DIMENSION}px por lado.`,
    };
  }

  return { ok: true };
};

export const isTrustedCompanyLogoUrl = (
  url: string | null | undefined,
): boolean => {
  if (!url?.trim()) {
    return false;
  }

  const trimmed = url.trim();

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return LEGACY_STATIC_LOGO_PREFIXES.some((prefix) =>
      trimmed.startsWith(prefix),
    );
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    return BLOB_HOST_SUFFIXES.some((suffix) =>
      parsed.hostname.endsWith(suffix),
    );
  } catch {
    return false;
  }
};

export const resolveCompanyLogoUrl = (
  url: string | null | undefined,
): string | null => (isTrustedCompanyLogoUrl(url) ? url!.trim() : null);
