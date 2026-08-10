export const normalizePhoneForTel = (
  value: string | null | undefined,
): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  return trimmed.startsWith('+') ? `+${digits}` : digits;
};

export const buildTelHref = (value: string | null | undefined): string | null => {
  const normalized = normalizePhoneForTel(value);
  return normalized ? `tel:${normalized}` : null;
};
