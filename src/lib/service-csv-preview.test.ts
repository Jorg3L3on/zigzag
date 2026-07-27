import { planServiceCsvImport } from '@/lib/service-csv-preview';
import { SERVICE_DESCRIPTION_MAX_LENGTH } from '@/lib/service-description';

describe('planServiceCsvImport', () => {
  it('rejects empty and oversized files', () => {
    expect(planServiceCsvImport([], []).success).toBe(false);
    const many = Array.from({ length: 501 }, (_, i) => ({
      nombre: `S${i}`,
      descripción: 'd',
      precio: '1',
    }));
    expect(planServiceCsvImport(many, []).success).toBe(false);
  });

  it('classifies ok rows from Spanish headers', () => {
    const result = planServiceCsvImport(
      [{ nombre: 'Lavado', descripción: 'Exterior', precio: '100' }],
      [],
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.summary).toEqual({ ok: 1, skipped: 0, failed: 0 });
    expect(result.data.rows[0]?.status).toBe('ok');
  });

  it('skips active case-insensitive name duplicates', () => {
    const result = planServiceCsvImport(
      [{ name: 'lavado', description: 'X', price: '10' }],
      ['Lavado'],
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.rows[0]?.status).toBe('skip');
    expect(result.data.summary.skipped).toBe(1);
  });

  it('allows soft-deleted names (not in active list)', () => {
    const result = planServiceCsvImport(
      [{ nombre: 'Viejo', descripción: 'ok', precio: '5' }],
      [],
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.rows[0]?.status).toBe('ok');
  });

  it('errors on description over 120', () => {
    const result = planServiceCsvImport(
      [
        {
          nombre: 'Largo',
          descripción: 'x'.repeat(SERVICE_DESCRIPTION_MAX_LENGTH + 1),
          precio: '1',
        },
      ],
      [],
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.rows[0]?.status).toBe('error');
    expect(result.data.summary.failed).toBe(1);
  });

  it('errors on invalid price', () => {
    const result = planServiceCsvImport(
      [{ nombre: 'A', descripción: 'B', precio: 'nope' }],
      [],
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.rows[0]?.status).toBe('error');
  });

  it('skips duplicate names within the same file', () => {
    const result = planServiceCsvImport(
      [
        { nombre: 'Uno', descripción: 'a', precio: '1' },
        { nombre: 'uno', descripción: 'b', precio: '2' },
      ],
      [],
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.summary).toEqual({ ok: 1, skipped: 1, failed: 0 });
  });
});
