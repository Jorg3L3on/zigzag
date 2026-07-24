import { formatCompanyAddress, formatCompanyAddressOneLine } from '@/lib/company-address';

describe('company address formatting', () => {
  it('omits country when state is already present', () => {
    const formatted = formatCompanyAddressOneLine({
      street: 'C. Camarote',
      exterior_number: '121',
      interior_number: null,
      neighborhood: 'Centro',
      city: 'Ponce',
      state: 'Puerto Rico',
      postal_code: '00716',
      country: 'México',
    });

    expect(formatted).toBe('C. Camarote, Ext. 121, Centro, Ponce, Puerto Rico, 00716');
    expect(formatted).not.toContain('México');
  });

  it('includes country when state is missing', () => {
    const formatted = formatCompanyAddress({
      street: 'Av. Reforma',
      exterior_number: '100',
      interior_number: null,
      neighborhood: 'Juárez',
      city: 'CDMX',
      state: '',
      postal_code: '06600',
      country: 'México',
    });

    expect(formatted).toContain('México');
  });
});
