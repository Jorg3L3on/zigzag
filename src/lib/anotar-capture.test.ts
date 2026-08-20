import { AnotarCaptureInput } from '@/lib/anotar-capture';

describe('AnotarCaptureInput', () => {
  const base = {
    client_name: 'María López',
    client_tel: '5551234567',
    total: 500,
    paid: 500,
    company_id: 1,
  };

  it('accepts a valid full-payment payload', () => {
    const result = AnotarCaptureInput.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.work_notes).toBe('');
    }
  });

  it('defaults work_notes to an empty string', () => {
    const result = AnotarCaptureInput.parse(base);
    expect(result.work_notes).toBe('');
  });

  it('accepts optional client_id and ticket_date', () => {
    const result = AnotarCaptureInput.safeParse({
      ...base,
      client_id: 42,
      ticket_date: new Date('2026-08-20T12:00:00.000Z'),
      work_notes: 'Instalación de boiler',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty client_name', () => {
    const result = AnotarCaptureInput.safeParse({
      ...base,
      client_name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty client_tel', () => {
    const result = AnotarCaptureInput.safeParse({
      ...base,
      client_tel: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative total', () => {
    const result = AnotarCaptureInput.safeParse({
      ...base,
      total: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative paid', () => {
    const result = AnotarCaptureInput.safeParse({
      ...base,
      paid: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects paid greater than total', () => {
    const result = AnotarCaptureInput.safeParse({
      ...base,
      total: 100,
      paid: 150,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('paid'))).toBe(
        true,
      );
    }
  });

  it('accepts partial payment when paid is less than or equal to total', () => {
    const result = AnotarCaptureInput.safeParse({
      ...base,
      total: 100,
      paid: 40,
    });
    expect(result.success).toBe(true);
  });

  it('accepts zero total with zero paid', () => {
    const result = AnotarCaptureInput.safeParse({
      ...base,
      total: 0,
      paid: 0,
    });
    expect(result.success).toBe(true);
  });
});
