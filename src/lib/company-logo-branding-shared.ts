export const getCompanyBrandInitials = (name: string): string => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'ZZ';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
};

export const getCompanyBrandFallbackHue = (name: string): number => {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  return hash;
};

export type PdfImageFormat = 'PNG' | 'JPEG' | 'WEBP';

export const detectPdfImageFormat = (
  dataUrl: string,
): PdfImageFormat | null => {
  if (dataUrl.startsWith('data:image/png')) {
    return 'PNG';
  }
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
    return 'JPEG';
  }
  if (dataUrl.startsWith('data:image/webp')) {
    return 'WEBP';
  }
  return null;
};
