/**
 * Content-Disposition with a name that keeps ñ and accents: an ASCII fallback
 * for old clients plus the RFC 5987 `filename*` the browsers use (ZIG-I36 M-20).
 */
export const contentDisposition = (type: string, fileName: string): string => {
  const ascii = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '');
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
};
