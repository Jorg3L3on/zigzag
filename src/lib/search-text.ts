import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

/**
 * Search that forgives accents, case and phone punctuation (ZIG-I36-25):
 * "munoz" finds "Muñoz", "555 000 0632" finds "(555) 000-0632".
 */

/** Lower case, accents removed (ñ → n). */
export const foldSearchText = (value: string | null | undefined): string =>
  (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Digits of a phone-like search, or '' when it has too few to mean a phone. */
export const searchPhoneDigits = (query: string): string => {
  // Only text made of digits and phone punctuation can be a phone.
  if (!/^[\d\s\-().+]+$/.test(query.trim())) return '';
  const digits = query.replace(/\D/g, '');
  return digits.length >= 3 ? digits : '';
};

/** Client-side match of a query against several fields (names, phones...). */
export const matchesSearchText = (
  fields: ReadonlyArray<string | null | undefined>,
  query: string,
): boolean => {
  const text = foldSearchText(query).trim();
  if (!text) return true;
  if (fields.some((field) => foldSearchText(field).includes(text))) return true;
  const digits = searchPhoneDigits(query);
  return Boolean(
    digits && fields.some((field) => (field ?? '').replace(/\D/g, '').includes(digits)),
  );
};

const escapeLikeText = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

const FOLD_FROM = 'áàäâãéèëêíìïîóòöôõúùüûñç';
const FOLD_TO = 'aaaaaeeeeiiiiooooouuuunc';

/** SQL twin of foldSearchText for a column (immutable, no extension needed). */
export const sqlFold = (column: SQLWrapper): SQL =>
  sql`translate(lower(${column}), ${FOLD_FROM}, ${FOLD_TO})`;

/**
 * `column` contains the search, ignoring accents and case; with a phone-like
 * search it also matches the column's digits. Escapes % and _ in the search.
 */
export const sqlFoldedContains = (column: SQLWrapper, query: string): SQL => {
  const text = foldSearchText(query).trim();
  const textMatch = sql`${sqlFold(column)} LIKE ${`%${escapeLikeText(text)}%`}`;
  const digits = searchPhoneDigits(query);
  if (!digits) return textMatch;
  return sql`(${textMatch} OR regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g') LIKE ${`%${digits}%`})`;
};
