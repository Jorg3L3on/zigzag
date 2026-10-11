import type { PresupuestoListItem } from '@/actions/presupuestos';

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const digitsOf = (value: string) => value.replace(/\D/g, '');

/**
 * Presupuestos list search (ZIG-I8-3): client name (accent- and case-insensitive),
 * `#id` / id digits, and client phone digits. A leading `#` limits the match to the id.
 */
export const matchesPresupuestoSearch = (
  item: Pick<PresupuestoListItem, 'id' | 'clientName' | 'clientTel'>,
  rawQuery: string,
): boolean => {
  const query = rawQuery.trim();
  if (query.length === 0) return true;

  const idOnly = query.startsWith('#');
  const digits = digitsOf(query);

  if (idOnly) {
    return digits.length > 0 && String(item.id).includes(digits);
  }

  if (item.clientName && fold(item.clientName).includes(fold(query))) {
    return true;
  }

  if (digits.length > 0 && /^[\d\s().+-]+$/.test(query)) {
    // Query is only digits (and phone punctuation): try id, then phone.
    if (String(item.id).includes(digits)) return true;
    return item.clientTel != null && digitsOf(item.clientTel).includes(digits);
  }

  return false;
};

export const filterPresupuestosBySearch = <T extends Pick<PresupuestoListItem, 'id' | 'clientName' | 'clientTel'>>(
  items: T[],
  query: string,
): T[] => items.filter((item) => matchesPresupuestoSearch(item, query));
