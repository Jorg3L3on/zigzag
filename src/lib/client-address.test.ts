import { formatClientAddressOneLine } from '@/lib/client-address';
import type { Client } from '@/actions/clients';

const baseClient = (overrides: Partial<Client> = {}): Client =>
  ({
    id: 1,
    name: 'Acme',
    email: null,
    phone: '555',
    document: null,
    address: null,
    street: 'Av. Reforma',
    exterior_number: '100',
    interior_number: null,
    neighborhood: 'Centro',
    city: 'CDMX',
    state: 'CDMX',
    postal_code: '06600',
    country: 'México',
    created_at: new Date(),
    updated_at: null,
    deleted_at: null,
    company_id: 1,
    ...overrides,
  }) as Client;

describe('formatClientAddressOneLine', () => {
  it('formats structured address including country by default', () => {
    expect(formatClientAddressOneLine(baseClient())).toBe(
      'Av. Reforma #100, Centro, CDMX, CDMX, CP 06600, México',
    );
  });

  it('omits country when includeCountry is false', () => {
    expect(
      formatClientAddressOneLine(baseClient(), { includeCountry: false }),
    ).toBe('Av. Reforma #100, Centro, CDMX, CDMX, CP 06600');
  });

  it('returns empty string when no address parts exist', () => {
    expect(
      formatClientAddressOneLine(
        baseClient({
          street: null,
          exterior_number: null,
          interior_number: null,
          neighborhood: null,
          city: null,
          state: null,
          postal_code: null,
          country: null,
          address: null,
        }),
        { includeCountry: false },
      ),
    ).toBe('');
  });

  it('falls back to legacy address and strips trailing country when excluded', () => {
    expect(
      formatClientAddressOneLine(
        baseClient({
          street: null,
          exterior_number: null,
          neighborhood: null,
          city: null,
          state: null,
          postal_code: null,
          address: 'Calle Legacy 12, México',
          country: 'México',
        }),
        { includeCountry: false },
      ),
    ).toBe('Calle Legacy 12');
  });
});

import { buildDirectionsHref } from '@/lib/client-address';

describe('buildDirectionsHref', () => {
  it('uses the full address from the parts', () => {
    const href = buildDirectionsHref(baseClient())!;
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('destination')).toBe(
      'Av. Reforma #100, Centro, CDMX, CDMX, CP 06600, México',
    );
  });
  it('uses the free text address when there are no parts', () => {
    const href = buildDirectionsHref(
      baseClient({
        street: null, exterior_number: null, neighborhood: null, city: null,
        state: null, postal_code: null, country: null, address: 'Calle 5 & 6, Mérida',
      }),
    )!;
    expect(new URL(href).searchParams.get('destination')).toBe('Calle 5 & 6, Mérida');
  });
  it('is null without an address', () => {
    expect(
      buildDirectionsHref(
        baseClient({
          street: null, exterior_number: null, neighborhood: null, city: null,
          state: null, postal_code: null, country: null, address: null,
        }),
      ),
    ).toBeNull();
  });
});
