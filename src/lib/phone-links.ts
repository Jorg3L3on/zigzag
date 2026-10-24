export const normalizePhoneForTel = (
  value: string | null | undefined,
): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  return trimmed.startsWith('+') ? `+${digits}` : digits;
};

/**
 * A phone as people read it: ten digits as `998 345 7712`, a +52 prefix kept;
 * anything else comes back as typed (ZIG-I13-7).
 */
export const formatPhoneDisplay = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10 && !trimmed.startsWith('+')) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 12 && digits.startsWith('52') && trimmed.startsWith('+')) {
    return `+52 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return trimmed;
};
