import {
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_DESCRIPTION_MAX_MESSAGE,
  serviceDescriptionSchema,
  serviceWriteSchema,
} from '@/lib/service-description';

describe('service description limits', () => {
  it('accepts description at exactly 120 characters', () => {
    const value = 'a'.repeat(SERVICE_DESCRIPTION_MAX_LENGTH);
    expect(serviceDescriptionSchema.safeParse(value).success).toBe(true);
  });

  it('rejects description longer than 120 characters', () => {
    const value = 'a'.repeat(SERVICE_DESCRIPTION_MAX_LENGTH + 1);
    const result = serviceDescriptionSchema.safeParse(value);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(SERVICE_DESCRIPTION_MAX_MESSAGE);
    }
  });

  it('trims before measuring length', () => {
    const value = `  ${'b'.repeat(SERVICE_DESCRIPTION_MAX_LENGTH)}  `;
    const result = serviceDescriptionSchema.safeParse(value);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(SERVICE_DESCRIPTION_MAX_LENGTH);
    }
  });

  it('serviceWriteSchema accepts valid payload at limit', () => {
    const result = serviceWriteSchema.safeParse({
      name: 'Lavado',
      description: 'x'.repeat(SERVICE_DESCRIPTION_MAX_LENGTH),
      price: '12.5',
    });
    expect(result.success).toBe(true);
  });

  it('serviceWriteSchema rejects over-limit description', () => {
    const result = serviceWriteSchema.safeParse({
      name: 'Lavado',
      description: 'x'.repeat(SERVICE_DESCRIPTION_MAX_LENGTH + 1),
      price: 10,
    });
    expect(result.success).toBe(false);
  });
});
