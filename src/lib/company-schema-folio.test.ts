import { describe, expect, it } from '@jest/globals';
import { companySettingsSchema, normalizeCompanySettingsForDb } from '@/lib/company-schema';

describe('company folio prefixes (ZIG-I17-6)', () => {
  it('accepts one to five letters or digits', () => {
    expect(companySettingsSchema.safeParse({ folio_prefix_ticket: 'rec1' }).success).toBe(true);
    expect(companySettingsSchema.safeParse({ folio_prefix_ticket: 'RECIB' }).success).toBe(true);
    expect(companySettingsSchema.safeParse({ folio_prefix_ticket: '' }).success).toBe(true);
  });

  it('rejects long prefixes and symbols', () => {
    expect(companySettingsSchema.safeParse({ folio_prefix_ticket: 'ABCDEF' }).success).toBe(false);
    expect(companySettingsSchema.safeParse({ folio_prefix_presupuesto: 'A-1' }).success).toBe(false);
  });

  it('refuses the same prefix for both series, defaults included', () => {
    expect(
      companySettingsSchema.safeParse({
        folio_prefix_presupuesto: 'doc',
        folio_prefix_ticket: 'DOC',
      }).success,
    ).toBe(false);
    // Empty means the default: presupuestos P, recibos R. A presupuesto prefix of R clashes.
    expect(companySettingsSchema.safeParse({ folio_prefix_presupuesto: 'r' }).success).toBe(false);
    expect(companySettingsSchema.safeParse({ folio_prefix_presupuesto: 'p' }).success).toBe(true);
  });

  it('stores uppercase and keeps an empty value so clearing resets to the default', () => {
    expect(
      normalizeCompanySettingsForDb({ folio_prefix_presupuesto: 'cot', folio_prefix_ticket: '' }),
    ).toEqual({ folio_prefix_presupuesto: 'COT', folio_prefix_ticket: '' });
  });
});
