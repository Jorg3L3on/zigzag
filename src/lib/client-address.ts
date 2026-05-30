import type { Client } from '@/actions/clients';

const hasText = (value: string | null | undefined): value is string =>
  Boolean(value?.trim());

export function formatClientAddressOneLine(client: Client): string {
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
    client.country,
  ].filter(hasText);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return client.address?.trim() ?? '';
}
