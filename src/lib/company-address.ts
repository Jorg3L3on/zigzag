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

const trimPart = (value: string | null | undefined): string => value?.trim() ?? '';

/** Multi-line formatted address for PDFs and detail views. */
export function formatCompanyAddress(c: AddressFields): string {
  const streetParts = [trimPart(c.street)].filter(Boolean);
  if (c.interior_number?.trim()) {
    streetParts.push(`Int. ${c.interior_number.trim()}`);
  }
  if (c.exterior_number?.trim()) {
    streetParts.push(`Ext. ${c.exterior_number.trim()}`);
  }
  const line1 = streetParts.join(', ');
  const locality = [
    trimPart(c.neighborhood),
    trimPart(c.city),
    trimPart(c.state),
    trimPart(c.postal_code),
  ].filter(Boolean);
  const country = trimPart(c.country);
  // When state/region is present, omit country to avoid contradictory strings
  // such as "Ponce, Puerto Rico, México" from mixed DB values.
  if (country && !trimPart(c.state)) {
    locality.push(country);
  }

  const lines = [line1, locality.join(', ')].filter((s) => s.length > 0);
  return lines.join('\n');
}

/** Single-line variant for compact UI / footer. */
export function formatCompanyAddressOneLine(c: AddressFields): string {
  return formatCompanyAddress(c).replace(/\n/g, ', ');
}
