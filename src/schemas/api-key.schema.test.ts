import { API_KEY_MAX_DAYS, createApiKeySchema } from '@/schemas/api-key.schema';

const base = { name: 'Agente', allowed_company_ids: [1] };

describe('createApiKeySchema expiry', () => {
  it('defaults to 365 days', () => {
    expect(createApiKeySchema.parse(base).expires_in_days).toBe(API_KEY_MAX_DAYS);
    expect(API_KEY_MAX_DAYS).toBe(365);
  });

  it('caps the expiry at 365 days', () => {
    expect(createApiKeySchema.parse({ ...base, expires_in_days: 30 }).expires_in_days).toBe(30);
    expect(() => createApiKeySchema.parse({ ...base, expires_in_days: 366 })).toThrow();
  });
});
