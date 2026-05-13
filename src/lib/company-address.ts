import type { Company } from '@/db/schema';

type AddressFields = Pick<
  Company,
  | 'street'
  | 'interior_number'
  | 'exterior_number'
  | 'neighborhood'
  | 'city'
  | 'state'
  | 'country'
  | 'postal_code'
>;

/** Multi-line formatted address for PDFs and detail views. */
export function formatCompanyAddress(c: AddressFields): string {
  const streetParts = [c.street.trim()];
  if (c.interior_number?.trim()) {
    streetParts.push(`Int. ${c.interior_number.trim()}`);
  }
  if (c.exterior_number?.trim()) {
    streetParts.push(`Ext. ${c.exterior_number.trim()}`);
  }
  const line1 = streetParts.join(', ');
  const locality = [
    c.neighborhood.trim(),
    c.city.trim(),
    c.state.trim(),
    c.postal_code.trim(),
    c.country.trim(),
  ].filter(Boolean);

  const lines = [line1, locality.join(', ')].filter((s) => s.length > 0);
  return lines.join('\n');
}

/** Single-line variant for compact UI / footer. */
export function formatCompanyAddressOneLine(c: AddressFields): string {
  return formatCompanyAddress(c).replace(/\n/g, ', ');
}
