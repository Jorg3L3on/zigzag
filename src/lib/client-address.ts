import type { Client } from '@/actions/clients';

const hasText = (value: string | null | undefined): value is string =>
  Boolean(value?.trim());

export type FormatClientAddressOptions = {
  /** When false, omit country from the address line (default true). */
  includeCountry?: boolean;
};

export function formatClientAddressOneLine(
  client: Client,
  options: FormatClientAddressOptions = {},
): string {
  const includeCountry = options.includeCountry !== false;

  const streetLine = [
    client.street,
    client.exterior_number ? `#${client.exterior_number}` : null,
    client.interior_number ? `Int. ${client.interior_number}` : null,
  ]
    .filter(hasText)
    .join(' ');

  const parts = [
    streetLine,
    client.neighborhood,
    client.city,
    client.state,
    client.postal_code ? `CP ${client.postal_code}` : null,
    includeCountry ? client.country : null,
  ].filter(hasText);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  const legacy = client.address?.trim() ?? '';
  if (!legacy) return '';

  if (!includeCountry) {
    const country = client.country?.trim();
    if (country && legacy === country) return '';
    if (country && legacy.endsWith(`, ${country}`)) {
      return legacy.slice(0, -(country.length + 2)).trim();
    }
    if (country && legacy.endsWith(` ${country}`)) {
      return legacy.slice(0, -(country.length + 1)).trim();
    }
  }

  return legacy;
}
